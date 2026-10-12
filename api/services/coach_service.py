import os
import json
import re
import asyncio
import numpy as np
import httpx
from datetime import datetime
from dotenv import load_dotenv

from api.dependencies.database import get_db_connection
from api.services.analysis_service import fetch_user_preferences, get_training_load, get_activity_detail, get_comprehensive_report_data
from api.services.calendar_service import sync_plan_to_calendar

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
GROQ_FALLBACK_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
PROMPTS_DIR = "prompts"
GLOBAL_REPORT_PROMPT = f"{PROMPTS_DIR}/global_report.md"
ACTIVITY_CYCLING_PROMPT = f"{PROMPTS_DIR}/activity_cycling.md"
ACTIVITY_RUNNING_PROMPT = f"{PROMPTS_DIR}/activity_running.md"
DATABASE_SCHEMA = "public"


def _prune_empty(value):
    """Recursively drops None and empty dict/list values to keep prompts compact."""
    if isinstance(value, dict):
        cleaned = {k: _prune_empty(v) for k, v in value.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != {} and v != []}
    if isinstance(value, list):
        cleaned = [_prune_empty(v) for v in value]
        return [v for v in cleaned if v is not None and v != {} and v != []]
    return value


def _parse_plan(text: str) -> list:
    """
    Parses the JSON training plan returned by the model. Accepts the flat list
    format, a {"workouts": [...]} object or a legacy {"weeks": [...]}
    shape. Returns a normalised list of workouts (only those with a date).
    """
    if not text:
        return []
    raw = None
    try:
        raw = json.loads(text)
    except Exception:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                raw = json.loads(match.group(0))
            except Exception as e:
                print(f"[COACH ERROR] Plan JSON parse failed: {e}")
                return []
        else:
            print("[COACH ERROR] Plan JSON parse failed: no JSON found")
            return []

    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        if isinstance(raw.get("workouts"), list):
            items = raw["workouts"]
        elif isinstance(raw.get("weeks"), list):
            items = [w for week in raw["weeks"] for w in week.get("workouts", [])]
        elif isinstance(raw.get("plan"), list):
            items = raw["plan"]
        else:
            print(f"[COACH WARNING] Unknown plan format: keys={list(raw.keys())}")
            items = []
    else:
        items = []

    workouts = []
    for w in items:
        if not isinstance(w, dict):
            continue
        date = w.get("date") or w.get("day")
        if not date:
            continue
        workouts.append({
            "date": date,
            "title": w.get("title") or f"Entreno {w.get('type', '')}".strip(),
            "description": w.get("description", ""),
            "type": w.get("type", "ride"),
            "duration": w.get("duration") or w.get("duration_min") or 0,
            "tss": w.get("tss") or w.get("tss_planned") or 0,
        })
    return workouts

# Reusable async client (connection pooling, HTTP/2)
_http_client = None


def _get_http_client():
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
    return _http_client


async def _call_groq(messages: list, temperature: float = 0.5, response_format: dict = None, max_tokens: int = None, max_retries: int = 3) -> str:
    """Calls Groq API asynchronously, returns the content string or raises."""
    api_key = os.getenv("GROQ_API_KEY", GROQ_API_KEY)
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    primary_model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)
    models_to_try = [primary_model] + [m for m in GROQ_FALLBACK_MODELS if m != primary_model]

    client = _get_http_client()
    last_error = None

    for current_model in models_to_try:
        payload = {
            "model": current_model,
            "messages": messages,
            "temperature": temperature,
        }
        if response_format is not None:
            payload["response_format"] = response_format
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        attempt = 0
        while True:
            try:
                response = await client.post(GROQ_URL, headers=headers, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    return data['choices'][0]['message']['content']

                error_detail = response.text
                print(f"\n--- GROQ API ERROR ({current_model}) ---\nStatus: {response.status_code}\nResponse: {error_detail}\n--- END ERROR ---\n")

                # Fallback if model not found
                if response.status_code == 404 and "model_not_found" in error_detail:
                    last_error = f"Groq API error {response.status_code}: {error_detail}"
                    print(f"[GROQ] Model {current_model} not found, attempting next fallback...")
                    break

                # Rate limit (TPM): wait and retry the same model
                if response.status_code == 429:
                    if attempt >= max_retries:
                        raise Exception(f"Groq API rate limit (429): {error_detail}")
                    wait = _retry_after_seconds(response, error_detail)
                    print(f"[GROQ] Rate limit 429 on {current_model}; retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                    await asyncio.sleep(wait)
                    attempt += 1
                    continue

                raise Exception(f"Groq API error {response.status_code}: {error_detail}")
            except httpx.HTTPError as e:
                print(f"\n--- GROQ HTTP EXCEPTION ({current_model}) ---\n{str(e)}\n--- END EXCEPTION ---\n")
                raise Exception(f"HTTP error: {str(e)}")

    raise Exception(f"All Groq models failed. Last error: {last_error}")


def _retry_after_seconds(response, error_detail: str) -> int:
    """Best-effort wait time for a Groq 429 (Retry-After header or message)."""
    header = response.headers.get('retry-after') if response is not None else None
    if header:
        try:
            return max(1, int(float(header)))
        except (TypeError, ValueError):
            pass
    match = re.search(r'try again in ([\d.]+)s', error_detail or '')
    if match:
        return max(1, int(float(match.group(1))) + 2)
    return 30

CYCLING_SPORTS = {'ride', 'cycling', 'virtualride', 'road_biking', 'gravel_cycling', 'mountain_biking', 'indoor_cycling', 'virtual_ride', 'e_bike_ride', 'mountain_bike', 'ciclismo'}

def is_running_sport(sport: str) -> bool:
    if not sport: return False
    s = sport.lower()
    return 'run' in s or 'running' in s or 'trail' in s or 'carrera' in s

def is_cycling_sport(sport: str) -> bool:
    if not sport: return False
    s = sport.lower()
    return s in CYCLING_SPORTS or 'cycl' in s or 'bike' in s or 'ride' in s or 'virtual' in s

async def analyze_single_activity(conn, user_id: str, activity_id: int) -> dict:
    """
    Generates an AI analysis for a specific activity.
    Detects sport type and uses appropriate instructions and metrics.
    """
    api_key = os.getenv("GROQ_API_KEY", GROQ_API_KEY)
    if not api_key:
        return {"error": "GROQ_API_KEY is not configured."}

    # 1. Fetch all necessary data
    activity_data = get_activity_detail(conn, user_id, activity_id)
    if "error" in activity_data:
        return activity_data

    activity = activity_data.get('activity', {})
    records = activity_data.get('records', [])
    sport = activity.get('sport', '')
    running = is_running_sport(sport)

    # 2. Fetch Athlete Context (full profile)
    prefs = fetch_user_preferences(conn, user_id)
    try:
        training_load = get_training_load(conn, user_id, months=6)
        if training_load and isinstance(training_load, dict):
            ctl = float(training_load.get('current_ctl', 0) or 0)
            atl = float(training_load.get('current_atl', 0) or 0)
            tsb = float(training_load.get('current_tsb', 0) or 0)
        else:
            ctl, atl, tsb = 0, 0, 0
    except Exception as e:
        print(f"Error fetching training load: {e}")
        ctl, atl, tsb = 0, 0, 0

    athlete_context = {
        "ctl": ctl, "atl": atl, "tsb": tsb,
        "weight_kg": prefs.get('weight', 0),
        "ftp": prefs.get('ftp', 0) if not running else None,
        "lthr": prefs.get('lthr', 0),
        "threshold_pace": prefs.get('threshold_pace', 0) if running else None,
        "athlete_profile": prefs.get('athlete_context', ''),
        "athlete_goal": prefs.get('athlete_goal', ''),
    }

    # 3. Load Instructions (sport-specific)
    instructions_file = ACTIVITY_RUNNING_PROMPT if running else ACTIVITY_CYCLING_PROMPT
    try:
        with open(instructions_file, "r", encoding="utf-8") as f:
            instructions = f.read()
    except FileNotFoundError:
        return {"error": f"Instructions file not found: {instructions_file}"}

    # 4. Extract and Calculate Metrics
    duration_sec = activity.get("duration_sec", 0)
    moving_time = activity.get("moving_time", duration_sec)
    avg_speed_ms = activity.get("avg_speed_ms", 0)
    avg_hr = activity.get('avg_hr')
    max_hr = activity.get('max_hr')
    np_val = activity.get('np')
    avg_power = activity.get('avg_power')
    cadence = activity.get('avg_cadence')
    tss = activity.get('tss')
    enriched = activity_data.get('enriched_context') or {}
    cardiac_drift = activity_data.get('cardiac_drift_pct')

    def is_valid(val):
        if val is None: return False
        try:
            return not np.isnan(float(val))
        except:
            return False

    # 5. Build summary_stats (sport-specific)
    dist_m = (activity.get('distance_km') or 0) * 1000

    summary_stats = {
        "name": activity.get('name') or 'Actividad',
        "sport": sport,
        "duration_min": round(duration_sec / 60, 1),
        "moving_time_min": round(moving_time / 60, 1) if moving_time else None,
    }

    if is_valid(dist_m / 1000):
        summary_stats["distance_km"] = round(dist_m / 1000, 2)
    if is_valid(activity.get('ascent_m')):
        summary_stats["ascent_m"] = round(float(activity.get('ascent_m')), 0)

    if running:
        # Running-specific metrics
        if avg_speed_ms and avg_speed_ms > 0:
            pace_sec = 1000 / avg_speed_ms
            summary_stats["avg_pace"] = f"{int(pace_sec // 60)}:{int(pace_sec % 60):02d}"
            summary_stats["avg_pace_sec_per_km"] = round(pace_sec, 1)
        if cadence and cadence > 0:
            summary_stats["cadence_spm"] = round(cadence)
        if is_valid(avg_hr): summary_stats["avg_hr"] = float(avg_hr)
        if is_valid(max_hr): summary_stats["max_hr"] = float(max_hr)
        if is_valid(tss): summary_stats["tss"] = round(float(tss))
        if prefs.get('threshold_pace'):
            tp_sec = 1000 / prefs['threshold_pace']
            summary_stats["threshold_pace"] = f"{int(tp_sec // 60)}:{int(tp_sec % 60):02d}"
        if enriched.get('stride_length_m'): summary_stats["stride_length_m"] = round(float(enriched['stride_length_m']), 2)
        if enriched.get('steps'): summary_stats["steps"] = int(enriched['steps'])
    else:
        # Cycling-specific metrics
        vi = round(np_val / avg_power, 2) if np_val and avg_power and avg_power > 0 else None
        if vi is not None and np.isnan(vi): vi = None
        if cardiac_drift is not None and np.isnan(cardiac_drift):
            cardiac_drift = None
        w_prime = activity_data.get('w_prime_est')
        if w_prime and np.isnan(w_prime):
            w_prime = None

        if is_valid(avg_power): summary_stats["avg_power"] = float(avg_power)
        if is_valid(np_val): summary_stats["np"] = round(float(np_val), 0)
        if is_valid(tss): summary_stats["tss"] = round(float(tss))
        if is_valid(vi): summary_stats["vi"] = vi
        if is_valid(activity.get('if')): summary_stats["intensity_factor"] = float(activity.get('if'))
        if is_valid(cardiac_drift): summary_stats["cardiac_drift_pct"] = round(float(cardiac_drift), 1)
        if is_valid(cadence): summary_stats["avg_cadence_rpm"] = float(cadence)
        if is_valid(avg_hr): summary_stats["avg_hr"] = float(avg_hr)
        if is_valid(max_hr): summary_stats["max_hr"] = float(max_hr)
        if w_prime: summary_stats["w_prime_joules"] = round(w_prime, 0)

    # 6. Prepare Final JSON
    zone_distribution = {
        "power": activity_data.get('time_in_power_zones') if not running else None,
        "hr": activity_data.get('time_in_hr_zones'),
    }
    zone_ranges = {
        "power": activity_data.get('power_zone_ranges') if not running else None,
        "hr": activity_data.get('hr_zone_ranges'),
    }

    laps = activity_data.get('laps') or []
    compact_laps = [
        {"lap": l.get('number'), "duration_min": l.get('duration_min'),
         "distance_km": l.get('distance_km'), "avg_speed_kmh": l.get('avg_speed'),
         "avg_hr": l.get('avg_hr')}
        for l in laps[:20]
    ] if len(laps) > 1 else []

    input_json = {
        "summary_stats": summary_stats,
        "zone_distribution": _prune_empty(zone_distribution),
        "zone_ranges": _prune_empty(zone_ranges),
        "athlete_context": athlete_context,
        "cardiac_drift_pct": round(float(cardiac_drift), 1) if cardiac_drift is not None and is_valid(cardiac_drift) else None,
        "cadence_stats": activity_data.get('cadence_stats') or {},
        "best_efforts": activity_data.get('best_efforts') or {},
        "enriched_context": enriched,
        "laps": compact_laps,
    }
    input_json = _prune_empty(input_json)

    # 7. Call AI
    json_sent = json.dumps(input_json, indent=2, default=str)
    salt = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
    prompt = f"{instructions}\n\n[ID_SESION: {salt}]\n\nDATOS DE LA ACTIVIDAD (JSON):\n{json_sent}"

    print(f"\n[SERVER] ANALYZING ACTIVITY: {activity_id} (sport: {sport}, running: {running})")
    print(f"[SERVER] DATA -> pace: {summary_stats.get('avg_pace')}, NP: {summary_stats.get('np')}, HR: {avg_hr}")

    try:
        analysis_markdown = await _call_groq(
            messages=[
                {"role": "system", "content": "Eres un entrenador deportivo analítico, motivador y con criterio deportivo riguroso. Habla en español de España."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5
        )

        with conn.cursor() as cursor:
            cursor.execute(
                f"UPDATE {DATABASE_SCHEMA}.activities SET coach_analysis = %s WHERE activity_id = %s AND user_id = %s",
                (analysis_markdown, activity_id, user_id)
            )
        conn.commit()

        return {
            "status": "ok",
            "analysis": analysis_markdown,
            "debug_info": {"id": activity_id, "sport": sport, "running": running}
        }

    except Exception as e:
        print(f"\n--- GROQ API ERROR ---\n{str(e)}\n--- END ERROR ---\n")
        return {"error": f"Error calling AI: {str(e)}"}

def _compact_report_data(d: dict) -> dict:
    """
    Builds a compact report payload. Groq's on-demand tier caps requests at
    8000 TPM, so the full series are trimmed to the essentials to leave room
    for the report output.
    """
    tl = d.get("training_load", {}) or {}
    mmp = d.get("mmp_curve", {}) or {}
    ef = d.get("efficiency_factor", {}) or {}
    vo2 = d.get("vo2max_history", {}) or {}
    vol = d.get("volume", {}) or {}
    recent = (d.get("recent_activities") or [])[:6]
    result = {
        "training_load": {
            "current_ctl": tl.get("current_ctl"),
            "current_atl": tl.get("current_atl"),
            "current_tsb": tl.get("current_tsb"),
            "last_7_days_tss": tl.get("last_7_days_tss"),
            "last_7_days_time_min": tl.get("last_7_days_time_min"),
            "dates_last_14": (tl.get("dates") or [])[-14:],
            "daily_tss_last_14": (tl.get("daily_tss") or [])[-14:],
        },
        "recent_activities": [
            {
                "date": a.get("date"), "sport": a.get("sport"), "tss": a.get("tss"),
                "distance_km": a.get("distance_km"), "duration_min": a.get("duration_min"),
                "avg_hr": a.get("avg_hr"), "avg_speed_kmh": a.get("avg_speed_kmh"),
            }
            for a in recent
        ],
        "mmp_curve": mmp.get("mmp_curve"),
        "all_time_curve": mmp.get("all_time_curve"),
        "w_prime_kj": mmp.get("w_prime_kj"),
        "ftp": mmp.get("ftp"),
        "efficiency_factor": {
            "dates": (ef.get("dates") or [])[-6:],
            "values": (ef.get("values") or [])[-6:],
        },
        "volume_weekly": {
            "labels": (vol.get("labels") or [])[-6:],
            "tss": (vol.get("tss") or [])[-6:],
            "hours": (vol.get("hours") or [])[-6:],
        },
        "intensity_distribution": d.get("intensity_distribution"),
        "sport_breakdown": d.get("sport_breakdown"),
        "load_balance": d.get("load_balance"),
        "thresholds": d.get("thresholds"),
        "compliance": d.get("compliance"),
    }
    # VO2max is estimated from FTP, so it is only meaningful with cycling data.
    if (d.get("sport_breakdown") or {}).get("cycling"):
        result["vo2max_cycling_estimate"] = vo2.get("current")
    return result


async def generate_coach_report(conn, user_id: str) -> dict:
    """
    Generates an AI coach report using Groq.
    Forces strict adherence to availability and refreshes both DB and Calendar.
    """
    api_key = os.getenv("GROQ_API_KEY", GROQ_API_KEY)
    if not api_key:
        return {"error": "GROQ_API_KEY is not configured."}

    # 1. Fetch User Profile
    prefs = fetch_user_preferences(conn, user_id)
    athlete_context = prefs.get('athlete_context', '')
    athlete_goal = prefs.get('athlete_goal', '')
    
    with conn.cursor() as cursor:
        cursor.execute("SELECT google_calendar_id FROM public.users WHERE user_id = %s", (user_id,))
        calendar_id = cursor.fetchone()[0]
    
    # 2. Fetch Comprehensive Performance Data
    try:
        from api.services.analysis_service import get_comprehensive_report_data
        report_data_json = get_comprehensive_report_data(conn, user_id, months=6)
        # Compact payload to fit Groq's 8000 TPM request limit
        report_data_json = _compact_report_data(report_data_json)
    except Exception as e:
        return {"error": f"Data error: {str(e)}"}

    # 3. Load Instructions
    if not os.path.exists(GLOBAL_REPORT_PROMPT):
        return {"error": "Instructions missing."}
    with open(GLOBAL_REPORT_PROMPT, "r", encoding="utf-8") as f:
        agent_instructions = f.read()

    # 4. Construct Enhanced Prompt with FULL DATA
    from datetime import timedelta
    today = datetime.now()
    dates_map = ""
    for i in range(1, 8):
        d = today + timedelta(days=i)
        dates_map += f"- {d.strftime('%Y-%m-%d')} ({d.strftime('%A')})\n"
    
    prompt = (
        f"{agent_instructions}\n\n"
        "--- DATOS DE RENDIMIENTO (JSON) ---\n"
        f"{json.dumps(report_data_json, indent=2)}\n\n"
        "--- PRIORIDADES CRÍTICAS ---\n"
        f"1. OBJETIVO: {athlete_goal}\n"
        f"2. CONSTRICCIONES: {athlete_context}\n"
        f"3. UMBRALES ACTUALES: {json.dumps(report_data_json.get('thresholds', {}), ensure_ascii=False)}\n"
        f"4. FECHA DE HOY: {today.strftime('%Y-%m-%d (%A)')}\n"
        "5. FECHAS OBJETIVO (7 días):\n"
        f"{dates_map}\n\n"
        "--- FORMATO ---\n"
        "- Redacta SOLO el informe narrativo en Markdown, sé conciso (máximo ~700 palabras).\n"
        "- Sigue las secciones de las instrucciones pero sin tablas largas ni repetir datos.\n"
        "- Termina siempre el informe (no lo dejes a medias).\n"
        "- NO incluyas bloques JSON ni la etiqueta <PLAN_UPDATE> (el plan se genera aparte).\n"
    )

    # 5. Call Groq
    try:
        full_text = await _call_groq(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres rIAcardo, un entrenador deportivo de ultra-resistencia de élite. Dominas ciclismo y running. "
                        "Tu tono es profesional, analítico, motivador y directo. No eres un asistente, eres un COACH de alto rendimiento. "
                        "Habla siempre en español de España. Utiliza terminología ciclista profesional (pacing, drift, TSS, CTL, sweetspot, etc.)."
                    )
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
            max_tokens=3000
        )
        print(f"--- COACH DEBUG ---\n{full_text}\n--- END DEBUG ---")

        # 6. Clean the narrative report (remove any accidental plan/JSON block)
        clean_pattern = re.compile(r'<PLAN_UPDATE>.*?</PLAN_UPDATE>', re.DOTALL | re.IGNORECASE)
        report_markdown = clean_pattern.sub('', full_text).strip()
        report_markdown = re.sub(r'```json.*?```', '', report_markdown, flags=re.DOTALL).strip()

        # 6b. Generate the 7-day plan in a dedicated JSON call so it can never be
        #     truncated by a long narrative report. Best-effort: if it fails, the
        #     report is still saved.
        load = report_data_json.get('training_load', {})
        plan_prompt = (
            "Eres un entrenador deportivo de élite. Diseña el plan de entrenamiento "
            "de los próximos 7 días para este atleta.\n\n"
            f"--- OBJETIVO ---\n{athlete_goal}\n\n"
            f"--- DISPONIBILIDAD Y CONTEXTO ---\n{athlete_context}\n\n"
            "--- ESTADO ACTUAL ---\n"
            f"CTL {load.get('current_ctl')}, ATL {load.get('current_atl')}, TSB {load.get('current_tsb')}; "
            f"últimos 7 días: {load.get('last_7_days_tss')} TSS en {load.get('last_7_days_time_min')} min.\n\n"
            "--- FECHAS (7 días, una por día) ---\n"
            f"{dates_map}\n"
            "--- FORMATO DE SALIDA ---\n"
            'Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma:\n'
            '{"workouts": [{"date": "YYYY-MM-DD", "title": "texto", "description": "texto", '
            '"type": "ride|run|strength|rest", "duration": 60, "tss": 50}]}\n'
            "Reglas:\n"
            "- Exactamente 7 objetos, uno por cada fecha indicada (usa esas fechas).\n"
            "- Si un día no puede entrenar, usa type='rest', duration=0, tss=0.\n"
            "- Respeta la disponibilidad del atleta y su objetivo.\n"
            "- No añadas texto fuera del JSON."
        )
        workouts = []
        try:
            plan_text = await _call_groq(
                messages=[
                    {"role": "system", "content": "Eres un entrenador de resistencia de élite. Respondes únicamente con JSON válido."},
                    {"role": "user", "content": plan_prompt},
                ],
                temperature=0.4,
                response_format={"type": "json_object"},
                max_tokens=2048,
            )
            print(f"--- COACH PLAN DEBUG ---\n{plan_text}\n--- END PLAN DEBUG ---")
            workouts = _parse_plan(plan_text)
        except Exception as plan_err:
            print(f"[COACH PLAN ERROR] {plan_err}")

        # 7. Update DB and Calendar
        with conn.cursor() as cursor:
            cursor.execute("INSERT INTO public.coach_reports (user_id, report_markdown) VALUES (%s, %s)", (user_id, report_markdown))
            if workouts:
                # Force clean old future plan
                cursor.execute("DELETE FROM public.planned_workouts WHERE user_id = %s AND date >= CURRENT_DATE", (user_id,))
                for w in workouts:
                    cursor.execute(
                        "INSERT INTO public.planned_workouts (user_id, date, title, description, workout_type, duration_min, tss_planned) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                        (user_id, w['date'], w['title'], w['description'], w['type'], w['duration'], w['tss'])
                    )
                if calendar_id:
                    try:
                        sync_plan_to_calendar(user_id, calendar_id, workouts)
                    except Exception as cal_err:
                        print(f"[CALENDAR ERROR] {str(cal_err)}")

        conn.commit()
        return {"status": "ok", "report": report_markdown, "workouts_synced": len(workouts)}

    except Exception as e:
        return {"error": f"Error: {str(e)}"}

def get_upcoming_workouts(conn, user_id: str):
    """Fetches planned workouts from today onwards."""
    today = datetime.now().date()
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT date, title, description, workout_type, duration_min, tss_planned FROM public.planned_workouts WHERE user_id = %s AND date >= %s ORDER BY date ASC LIMIT 14",
            (user_id, today)
        )
        return [{"date": str(r[0]), "title": r[1], "description": r[2], "type": r[3], "duration": r[4], "tss": r[5]} for r in cursor.fetchall()]


def get_weekly_tss_comparison(conn, user_id: str, date_str: str) -> dict:
    """
    Returns total planned vs actual TSS for a specific week.
    """
    from datetime import datetime, timedelta
    from api.services.analysis_service import get_activities_list
    
    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    start_of_week = target_date - timedelta(days=target_date.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    
    # 1. Planned TSS
    query_planned = "SELECT SUM(tss_planned) FROM public.planned_workouts WHERE user_id = %s AND date >= %s AND date <= %s"
    with conn.cursor() as cursor:
        cursor.execute(query_planned, (user_id, start_of_week, end_of_week))
        planned_tss = cursor.fetchone()[0] or 0
    
    # 2. Actual TSS
    actual_list = get_activities_list(conn, user_id, datetime.combine(start_of_week, datetime.min.time()), datetime.combine(end_of_week, datetime.max.time()))
    actual_tss = sum(a.get('tss', 0) for a in actual_list)

    return {
        "start_date": str(start_of_week),
        "end_date": str(end_of_week),
        "planned_tss": round(float(planned_tss), 0),
        "actual_tss": round(float(actual_tss), 0),
        "compliance_pct": round((actual_tss / planned_tss * 100), 1) if planned_tss > 0 else 0
    }

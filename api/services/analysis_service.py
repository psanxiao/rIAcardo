"""
Analysis service: wraps the existing performance analysis functions
and adapts them for multi-user API consumption.
"""
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta

from api.dependencies.database import get_db_connection

# Import the pure calculation functions from the decoupled module
from api.services.core_calculations import (
    calculate_normalized_power,
    calculate_tss,
    calculate_hrtss,
    calculate_rtss,
    calculate_ctl_atl_tsb,
    calculate_cardiac_drift,
    get_mmp_curve,
    estimate_w_prime,
    calculate_best_intervals,
    MMP_DURATIONS,
    DEFAULT_FTP,
    DEFAULT_LTHR,
    DEFAULT_CTL_TC,
    DEFAULT_ATL_TC,
    DEFAULT_NP_ROLLING_SECONDS,
    DEFAULT_THRESHOLD_PACE,
    DEFAULT_POWER_ZONES_LIST,
    DEFAULT_HR_ZONES_LIST,
    calculate_activity_tss,
    calculate_w_bal,
    calculate_race_predictions,
)

DATABASE_SCHEMA = "public"


def _is_running_sport(sport) -> bool:
    if not sport:
        return False
    s = str(sport).lower()
    return 'run' in s or 'trail' in s or 'carrera' in s


def _is_cycling_sport(sport) -> bool:
    if not sport:
        return False
    s = str(sport).lower()
    return (s in ['ride', 'cycling', 'virtualride', 'road_biking', 'gravel_cycling',
                  'mountain_biking', 'indoor_cycling', 'virtual_ride', 'e_bike_ride',
                  'mountain_bike', 'ciclismo']
            or 'cycl' in s or 'bike' in s or 'ride' in s or 'virtual' in s)


# Curated Garmin session_data fields worth sending to the model.
_ENRICHED_COMMON = {
    "temperature_avg_c": "averageTemperature",
    "temperature_max_c": "maxTemperature",
    "temperature_min_c": "minTemperature",
    "calories": "calories",
    "training_effect": "trainingEffect",
    "training_effect_label": "trainingEffectLabel",
    "aerobic_training_effect": "aerobicTrainingEffect",
    "anaerobic_training_effect": "anaerobicTrainingEffect",
    "respiration_avg": "avgRespirationRate",
    "respiration_max": "maxRespirationRate",
}

_ENRICHED_CYCLING = {
    "avg_cadence_rpm": "averageBikeCadence",
    "avg_seated_cadence_rpm": "averageSeatedCadence",
    "avg_standing_cadence_rpm": "averageStandingCadence",
    "avg_seated_power_w": "averageSeatedPower",
    "avg_standing_power_w": "averageStandingPower",
    "seated_time_s": "seatedTime",
    "standing_time_s": "standingTime",
    "max_power_20min_w": "maxPowerTwentyMinutes",
    "total_strokes": "totalNumberOfStrokes",
    "left_torque_effectiveness_pct": "leftTorqueEffectiveness",
    "right_torque_effectiveness_pct": "rightTorqueEffectiveness",
    "left_pedal_smoothness_pct": "leftPedalSmoothness",
    "right_pedal_smoothness_pct": "rightPedalSmoothness",
    "left_platform_center_offset_mm": "leftPlatformCenterOffset",
    "right_platform_center_offset_mm": "rightPlatformCenterOffset",
    "device_normalized_power_w": "normalizedPower",
    "device_intensity_factor": "intensityFactor",
    "device_tss": "trainingStressScore",
    "device_ftp_w": "functionalThresholdPower",
    "activity_training_load": "activityTrainingLoad",
    "water_consumed_ml": "waterConsumed",
}

_ENRICHED_RUNNING = {
    "run_cadence_spm": "averageRunCadence",
    "max_run_cadence_spm": "maxRunCadence",
    "steps": "steps",
    "stride_length_m": "strideLength",
    "device_lt_pace_ms": "lactateThresholdSpeed",
    "device_lthr": "lactateThresholdHeartRate",
    "moderate_intensity_min": "moderateIntensityMinutes",
    "vigorous_intensity_min": "vigorousIntensityMinutes",
}


def _build_enriched_context(session_data, sport) -> dict:
    """Extracts a curated set of Garmin session fields (only those present)."""
    if not isinstance(session_data, dict):
        return {}
    mapping = dict(_ENRICHED_COMMON)
    if _is_running_sport(sport):
        mapping.update(_ENRICHED_RUNNING)
    elif _is_cycling_sport(sport):
        mapping.update(_ENRICHED_CYCLING)

    out = {}
    for out_key, src_key in mapping.items():
        val = session_data.get(src_key)
        if val is None or val == "":
            continue
        out[out_key] = val

    # Garmin reports stride length in centimeters; normalise to meters.
    if 'stride_length_m' in out:
        try:
            out['stride_length_m'] = round(float(out['stride_length_m']) / 100, 2)
        except (TypeError, ValueError):
            out.pop('stride_length_m', None)

    return out


def _cadence_stats(cadences) -> dict:
    """Mean/max/p95 of the non-zero cadence values."""
    if not cadences:
        return {}
    arr = np.asarray(cadences, dtype=float)
    return {
        "avg": round(float(arr.mean()), 1),
        "max": int(arr.max()),
        "p95": int(np.percentile(arr, 95)),
    }


def _seconds_to_pace(sec_per_km) -> str:
    return f"{int(sec_per_km // 60)}:{int(sec_per_km % 60):02d}"


def _best_efforts(records, sport) -> dict:
    """
    Best sustained efforts within the activity: power for cycling, pace for
    running, over 1/5/20 min windows.
    """
    windows = {"1min": 60, "5min": 300, "20min": 1200}
    out = {}
    if _is_running_sport(sport):
        speeds = [r['speed'] / 3.6 for r in records if r.get('speed')]
        if not speeds:
            return {}
        series = pd.Series(speeds)
        for label, w in windows.items():
            if len(series) < w:
                continue
            best = calculate_best_intervals(series, w)
            if best and not np.isnan(best):
                out[f"{label}_pace"] = _seconds_to_pace(1000 / best)
    else:
        powers = [r['power'] for r in records if r.get('power')]
        if not powers:
            return {}
        series = pd.Series(powers)
        for label, w in windows.items():
            if len(series) < w:
                continue
            best = calculate_best_intervals(series, w)
            if best and not np.isnan(best):
                out[f"{label}_w"] = int(round(best))
    return out


def _summarize_by_sport(activities) -> dict:
    """Totals per sport group over a list of activity summaries."""
    groups = {
        "running": {"sessions": 0, "tss": 0.0, "hours": 0.0, "distance_km": 0.0},
        "cycling": {"sessions": 0, "tss": 0.0, "hours": 0.0, "distance_km": 0.0},
        "other": {"sessions": 0, "tss": 0.0, "hours": 0.0, "distance_km": 0.0},
    }
    for a in activities:
        sport = a.get('sport')
        if _is_running_sport(sport):
            key = "running"
        elif _is_cycling_sport(sport):
            key = "cycling"
        else:
            key = "other"
        g = groups[key]
        g["sessions"] += 1
        g["tss"] = round(g["tss"] + float(a.get('tss') or 0), 1)
        g["hours"] = round(g["hours"] + float(a.get('duration_min') or 0) / 60, 1)
        g["distance_km"] = round(g["distance_km"] + float(a.get('distance_km') or 0), 1)
    return {k: v for k, v in groups.items() if v["sessions"] > 0}


def _rest_and_monotony(dates, daily_tss) -> dict:
    """Rest days in the last 28 days and Foster's weekly monotony (7d)."""
    if not daily_tss:
        return {}
    ts = np.asarray(daily_tss, dtype=float)
    last28 = ts[-28:]
    out = {"rest_days_last_28": int(np.sum(last28 == 0))}
    last7 = ts[-7:]
    if len(last7) >= 2:
        mean = float(np.mean(last7))
        sd = float(np.std(last7))
        out["weekly_monotony"] = round(mean / sd, 2) if sd > 0 else None
    return out


def get_thresholds_history(conn, user_id: str) -> dict:
    """Current thresholds plus FTP change history."""
    prefs = fetch_user_preferences(conn, user_id)
    ftp_history = []
    with conn.cursor() as cursor:
        cursor.execute(
            f"SELECT start_date, ftp_value FROM {DATABASE_SCHEMA}.ftp_history WHERE user_id = %s ORDER BY start_date ASC",
            (user_id,)
        )
        ftp_history = [{"date": str(r[0]), "ftp": r[1]} for r in cursor.fetchall()]
    return {
        "ftp_current": prefs.get('ftp'),
        "lthr": prefs.get('lthr'),
        "threshold_pace_ms": prefs.get('threshold_pace'),
        "weight_kg": prefs.get('weight'),
        "ftp_history": ftp_history[-12:],
    }


def get_recent_activity_analyses(conn, user_id: str, limit: int = 3) -> list:
    """Latest stored per-activity coach analyses, for continuity of context."""
    with conn.cursor() as cursor:
        cursor.execute(
            f"SELECT start_time, sport, coach_analysis FROM {DATABASE_SCHEMA}.activities "
            "WHERE user_id = %s AND coach_analysis IS NOT NULL AND coach_analysis <> '' "
            "ORDER BY start_time DESC LIMIT %s",
            (user_id, limit)
        )
        rows = cursor.fetchall()
    return [
        {"date": str(r[0])[:10], "sport": r[1], "analysis": (r[2] or '')[:300]}
        for r in rows
    ]



def fetch_user_preferences(conn, user_id: str) -> dict:
    """Fetches user preferences from the database for a specific user."""
    prefs = {}
    with conn.cursor() as cursor:
        cursor.execute(
            f"SELECT preference_key, preference_value FROM {DATABASE_SCHEMA}.user_preferences WHERE user_id = %s",
            (user_id,)
        )
        for key, value in cursor.fetchall():
            prefs[key] = value

    # Type conversions and JSON decoding
    for key in ['ftp', 'hr_max', 'ctl_time_constant', 'atl_time_constant', 'np_rolling_seconds', 'lthr', 'hr_rest']:
        if key in prefs:
            try:
                prefs[key] = int(prefs[key])
            except (ValueError, TypeError):
                del prefs[key]

    for key in ['threshold_pace', 'weight']:
        if key in prefs:
            try:
                prefs[key] = float(prefs[key])
            except (ValueError, TypeError):
                del prefs[key]

    for key in ['power_zones', 'hr_zones', 'power_zones_custom', 'hr_zones_custom']:
        if key in prefs and isinstance(prefs[key], str):
            try:
                prefs[key] = json.loads(prefs[key])
            except:
                pass

    return prefs


def get_ftp_for_date(conn, user_id: str, date: datetime, current_ftp: int = DEFAULT_FTP) -> int:
    """
    Returns the FTP that was active on a specific date from the ftp_history table.
    """
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"SELECT ftp_value FROM {DATABASE_SCHEMA}.ftp_history WHERE user_id = %s AND start_date <= %s ORDER BY start_date DESC LIMIT 1",
                (user_id, date)
            )
            row = cursor.fetchone()
            if row:
                return int(row[0])
    except Exception as e:
        print(f"Error fetching historical FTP: {e}")
    
    return current_ftp


def fetch_activities_for_user(conn, user_id: str, start_date: datetime):
    """Fetches activities and records for a user from the given start_date, excluding ignored ones."""
    query_activities = f"""
    SELECT activity_id, start_time, total_elapsed_time, total_distance, total_ascent, sport
    FROM {DATABASE_SCHEMA}.activities
    WHERE user_id = %s AND start_time >= %s AND ignore_mmp = FALSE
    ORDER BY start_time ASC;
    """
    df_activities = pd.read_sql(query_activities, conn, params=(user_id, start_date), index_col='activity_id')

    activity_ids = tuple(df_activities.index.tolist())
    if not activity_ids:
        return df_activities, pd.DataFrame()

    query_records = f"""
    SELECT activity_id, timestamp, power, heart_rate, speed
    FROM {DATABASE_SCHEMA}.records
    WHERE activity_id IN %s AND user_id = %s
    ORDER BY activity_id, timestamp;
    """
    df_records = pd.read_sql(query_records, conn, params=(activity_ids, user_id), parse_dates=['timestamp'])

    return df_activities, df_records


def get_training_load(conn, user_id: str, months: int = 6) -> dict:
    """
    Calculates CTL, ATL, TSB for a user over the specified period.
    """
    prefs = fetch_user_preferences(conn, user_id)
    ftp = prefs.get('ftp', DEFAULT_FTP)
    lthr = prefs.get('lthr', DEFAULT_LTHR)
    ctl_tc = prefs.get('ctl_time_constant', DEFAULT_CTL_TC)
    atl_tc = prefs.get('atl_time_constant', DEFAULT_ATL_TC)
    np_rolling = prefs.get('np_rolling_seconds', DEFAULT_NP_ROLLING_SECONDS)
    threshold_pace = prefs.get('threshold_pace', 0)

    start_date = datetime.now() - timedelta(days=months * 30)
    df_activities, df_records = fetch_activities_for_user(conn, user_id, start_date)

    if df_activities.empty:
        return {"dates": [], "ctl": [], "atl": [], "tsb": [], "daily_tss": []}

    activity_tss_list = []
    activity_details = []

    for act_id, act_row in df_activities.iterrows():
        act_records = df_records[df_records['activity_id'] == act_id]
        sport = act_row.get('sport', '').lower()
        duration = act_row['total_elapsed_time']
        act_date = act_row['start_time']
        
        # Use historical FTP for this activity
        current_act_ftp = get_ftp_for_date(conn, user_id, act_date, ftp)
        
        # Determine metrics for TSS
        np_val = None
        avg_hr = None
        avg_speed = None

        if not act_records.empty:
            if 'power' in act_records.columns:
                power_series = act_records['power'].dropna()
                if not power_series.empty:
                    np_val = calculate_normalized_power(power_series, np_rolling)
            
            if 'heart_rate' in act_records.columns:
                avg_hr = act_records['heart_rate'].mean()
            
            if 'speed' in act_records.columns:
                avg_speed = act_records['speed'].mean()
        
        # Fallback for avg_speed if no records but we have total_distance
        if avg_speed is None or np.isnan(avg_speed):
            total_dist = act_row.get('total_distance', 0)
            if total_dist > 0 and duration > 0:
                avg_speed = total_dist / duration

        tss = calculate_activity_tss(
            duration, sport, 
            np_val=np_val, ftp=current_act_ftp, 
            avg_hr=avg_hr, lthr=lthr, 
            avg_speed=avg_speed, threshold_pace=threshold_pace
        )

        # Persist calculated TSS and NP back to DB if they were calculated accurately (with records)
        if not act_records.empty:
            try:
                with conn.cursor() as cursor:
                    # Get existing metrics to merge
                    cursor.execute(f"SELECT detected_metrics FROM {DATABASE_SCHEMA}.activities WHERE activity_id = %s", (act_id,))
                    existing = cursor.fetchone()[0]
                    metrics = existing if isinstance(existing, dict) else (json.loads(existing) if existing else {})
                    
                    metrics['tss'] = round(float(tss), 1)
                    if np_val: metrics['np'] = round(float(np_val), 0)
                    
                    cursor.execute(f"UPDATE {DATABASE_SCHEMA}.activities SET detected_metrics = %s WHERE activity_id = %s", (json.dumps(metrics), act_id))
                conn.commit()
            except: pass

        activity_tss_list.append({'date': act_row['start_time'], 'tss': round(tss, 1), 'sport': sport})
        
        # Build detailed activity info for the report
        avg_hr = None
        avg_speed = None
        if not act_records.empty:
            if 'heart_rate' in act_records.columns:
                hr_vals = act_records['heart_rate'].dropna()
                if not hr_vals.empty:
                    avg_hr = round(float(hr_vals.mean()), 0)
            if 'speed' in act_records.columns:
                spd_vals = act_records['speed'].dropna()
                if not spd_vals.empty:
                    avg_speed = round(float(spd_vals.mean()) * 3.6, 1)  # Convert m/s to km/h
        
        activity_details.append({
            'activity_id': int(act_id), 'date': str(act_row['start_time'].date()), 'tss': round(tss, 1), 
            'sport': sport, 'distance_km': round(act_row.get('total_distance', 0) / 1000, 1), 'duration_min': round(duration / 60, 0),
            'avg_hr': avg_hr, 'avg_speed_kmh': avg_speed,
        })

    tss_df = pd.DataFrame(activity_tss_list)
    tss_df['date'] = pd.to_datetime(tss_df['date']).dt.date
    daily_tss = tss_df.groupby('date')['tss'].sum()
    full_range = pd.date_range(start=start_date.date(), end=datetime.now().date())
    daily_tss = daily_tss.reindex(full_range.date, fill_value=0)

    df_load = calculate_ctl_atl_tsb(daily_tss, ctl_tc, atl_tc)

    # Calculate last 7 days metrics (actual calendar days)
    today = datetime.now().date()
    seven_days_ago = today - timedelta(days=6)
    last_7_days_tss_val = daily_tss.loc[seven_days_ago:today].sum()
    last_7_days_time = sum(act['duration_min'] for act in activity_details if (today - datetime.strptime(act['date'], '%Y-%m-%d').date()).days < 7)


    # Calculate VO2 Max current estimate
    weight = prefs.get('weight', 88)
    base_vo2 = ((ftp / 0.83) * 10.8 / weight) + 7 if weight > 0 else 0
    current_ctl = df_load['CTL'].iloc[-1] if not df_load.empty else 0
    max_ctl = max(df_load['CTL'].tolist()) if not df_load.empty else 80
    if max_ctl < 40: max_ctl = 80
    factor = 0.92 + (0.08 * (current_ctl / max_ctl))
    current_vo2 = round(base_vo2 * factor, 1)

    return {
        "dates": [str(d) for d in df_load.index],
        "ctl": [round(v, 1) for v in df_load['CTL'].tolist()],
        "atl": [round(v, 1) for v in df_load['ATL'].tolist()],
        "tsb": [round(v, 1) for v in df_load['TSB'].tolist()],
        "daily_tss": [round(v, 1) for v in daily_tss.tolist()],
        "activities": activity_details,
        "current_ctl": round(current_ctl, 1),
        "current_atl": round(df_load['ATL'].iloc[-1], 1) if not df_load.empty else 0,
        "current_tsb": round(df_load['TSB'].iloc[-1], 1) if not df_load.empty else 0,
        "current_vo2max": current_vo2,
        "last_7_days_tss": round(float(last_7_days_tss_val), 1),
        "last_7_days_time_min": int(last_7_days_time),
    }


def get_mmp_data(conn, user_id: str, months: int = 12) -> dict:
    """
    Calculates the MMP curve and W' estimate for a user.
    """
    prefs = fetch_user_preferences(conn, user_id)
    ftp = prefs.get('ftp', DEFAULT_FTP)
    start_date = datetime.now() - timedelta(days=months * 30)
    df_activities, df_records = fetch_activities_for_user(conn, user_id, start_date)
    
    period_mmp = {}
    if not df_records.empty and 'power' in df_records.columns:
        all_power = df_records['power'].dropna()
        period_mmp = get_mmp_curve(all_power)

    all_time_mmp = {}
    mmp_sources = {}
    try:
        query = f"SELECT mmp_data, activity_id, start_time, product_name FROM {DATABASE_SCHEMA}.activities WHERE user_id = %s AND mmp_data IS NOT NULL AND ignore_mmp = FALSE"
        with conn.cursor() as cursor:
            cursor.execute(query, (user_id,))
            rows = cursor.fetchall()
            global_max = {}
            for row in rows:
                act_mmp = row[0]
                if isinstance(act_mmp, str): act_mmp = json.loads(act_mmp)
                if isinstance(act_mmp, dict):
                    for dur_str, watts in act_mmp.items():
                        dur = int(dur_str)
                        if dur not in global_max or watts > global_max[dur]:
                            global_max[dur] = watts
                            mmp_sources[dur] = {"activity_id": row[1], "date": row[2].strftime("%Y-%m-%d"), "name": row[3] or "Actividad"}
            all_time_mmp = global_max
    except: pass

    if not all_time_mmp: all_time_mmp = period_mmp
    w_prime = estimate_w_prime(all_time_mmp, ftp)
    duration_labels = {1:"1s", 2:"2s", 5:"5s", 10:"10s", 30:"30s", 60:"1min", 120:"2min", 300:"5min", 600:"10min", 1200:"20min", 1800:"30min", 3600:"1h", 5400:"1h30", 7200:"2h"}
    
    formatted_period = {duration_labels.get(d, f"{d}s"): period_mmp.get(d, 0) for d in MMP_DURATIONS}
    formatted_all_time = {duration_labels.get(d, f"{d}s"): all_time_mmp.get(d, 0) for d in MMP_DURATIONS}
    formatted_sources = {duration_labels.get(d, f"{d}s"): mmp_sources.get(d, {}) for d in MMP_DURATIONS}

    return {
        "mmp_curve": formatted_period, "all_time_curve": formatted_all_time, "all_time_sources": formatted_sources,
        "mmp_raw": period_mmp, "all_time_raw": all_time_mmp, "w_prime_joules": w_prime, "w_prime_kj": round(w_prime / 1000, 1),
        "ftp": ftp, "weight": prefs.get('weight', 0),
    }


def get_activity_detail(conn, user_id: str, activity_id: int) -> dict:
    """
    Fetches full detail for a specific activity.
    """
    prefs = fetch_user_preferences(conn, user_id)
    ftp = prefs.get('ftp', DEFAULT_FTP)
    lthr = prefs.get('lthr', DEFAULT_LTHR)
    np_rolling = prefs.get('np_rolling_seconds', DEFAULT_NP_ROLLING_SECONDS)

    with conn.cursor() as cursor:
        cursor.execute(
            f"SELECT activity_id, garmin_activity_id, start_time, total_elapsed_time, moving_time, total_distance, total_ascent, total_calories, avg_speed, max_speed, avg_heart_rate, max_heart_rate, sport, session_data, ignore_mmp, coach_analysis, detected_metrics, mmp_data FROM {DATABASE_SCHEMA}.activities WHERE activity_id = %s AND user_id = %s",
            (activity_id, user_id)
        )
        row = cursor.fetchone()
        if not row: return {"error": "Activity not found"}

        def safe_round(val, digits=0):
            if val is None or (isinstance(val, float) and np.isnan(val)):
                return None
            return round(val, digits)

        activity = {
            "activity_id": row[0], "garmin_id": row[1], "start_time": str(row[2]), "duration_sec": row[3],
            "moving_time": row[4] or row[3],
            "distance_km": safe_round(row[5] / 1000, 2) if row[5] is not None else 0,
            "ascent_m": row[6] or 0, "calories": row[7] or 0, 
            "avg_speed": safe_round(row[8] * 3.6, 1) if row[8] is not None else 0, 
            "avg_speed_ms": row[8] if row[8] is not None else 0,
            "max_speed": safe_round(row[9] * 3.6, 1) if row[9] is not None else 0,
            "avg_hr": row[10], "max_hr": row[11], "sport": row[12], "raw_data": row[13], "ignore_mmp": row[14], "coach_analysis": row[15],
            "detected_metrics": row[16], "mmp_data": row[17]
        }

        raw = activity.get('raw_data')
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = {}
        activity["name"] = (raw or {}).get('name') or (raw or {}).get('activityName') or f"Actividad {activity['sport']}"

        # Recalculate avg_speed from distance / moving_time (Garmin avg_speed uses elapsed time)
        moving_speed_ms = None
        if activity["moving_time"] and activity["moving_time"] > 0 and row[5]:
            moving_speed_ms = row[5] / activity["moving_time"]
            activity["avg_speed_ms"] = moving_speed_ms
            activity["avg_speed"] = safe_round(moving_speed_ms * 3.6, 1)

        cursor.execute(f"SELECT timestamp, power, heart_rate, speed, cadence, distance, altitude, position_lat, position_lng FROM {DATABASE_SCHEMA}.records WHERE activity_id = %s AND user_id = %s ORDER BY timestamp ASC", (activity_id, user_id))
        records, powers, hrs, cadences, speeds = [], [], [], [], []
        for r in cursor.fetchall():
            records.append({"time": str(r[0]), "power": r[1], "hr": r[2], "speed": round(r[3] * 3.6, 1) if r[3] else 0, "cadence": r[4], "distance": r[5], "altitude": r[6], "lat": r[7], "lng": r[8]})
            if r[1] is not None: powers.append(r[1])
            if r[2] is not None: hrs.append(r[2])
            if r[4] is not None and r[4] > 0: cadences.append(r[4])
            if r[3] is not None: speeds.append(r[3])

        # Recalculate everything from records to ensure fresh data
        avg_power = float(np.mean(powers)) if powers else 0
        avg_cadence = float(np.mean(cadences)) if cadences else 0
        avg_hr = float(np.mean(hrs)) if hrs else activity.get('avg_hr', 0)

        # Speed used for TSS: prefer moving speed (excludes stops), fall back to stream mean
        if moving_speed_ms:
            speed_for_tss = moving_speed_ms
        elif speeds:
            speed_for_tss = float(np.mean(speeds))
        else:
            speed_for_tss = row[7] or 0

        if np.isnan(avg_power): avg_power = 0
        if np.isnan(avg_cadence): avg_cadence = 0

        sport = activity['sport'].lower()
        np_val = None
        if powers:
            np_val = calculate_normalized_power(pd.Series(powers), np_rolling)
        
        tss = calculate_activity_tss(
            activity['duration_sec'], sport,
            np_val=np_val, ftp=ftp,
            avg_hr=avg_hr, lthr=lthr,
            avg_speed=speed_for_tss, threshold_pace=prefs.get('threshold_pace', 0)
        )
        
        if_val = None
        cycling_sports = ['ride', 'cycling', 'virtualride', 'road_biking', 'gravel_cycling', 'mountain_biking', 'indoor_cycling', 'virtual_ride', 'e_bike_ride', 'mountain_bike']
        if sport in cycling_sports and np_val and ftp > 0:
            if_val = np_val / ftp

        # Cardiac drift / decoupling: power/HR for cycling, pace/HR for running
        cardiac_drift = None
        if records:
            try:
                cardiac_drift = calculate_cardiac_drift(pd.DataFrame(records), activity['duration_sec'])
                if cardiac_drift is not None and np.isnan(cardiac_drift):
                    cardiac_drift = None
            except Exception:
                cardiac_drift = None

        # OVERWRITE activity object to ensure these are the values used
        activity["np"] = round(float(np_val), 0) if np_val and not np.isnan(np_val) else None
        activity["if"] = round(float(if_val), 2) if if_val and not np.isnan(if_val) else None
        activity["tss"] = round(float(tss), 1) if tss and not np.isnan(tss) else 0
        activity["avg_power"] = round(avg_power, 0)
        activity["avg_cadence"] = round(avg_cadence, 0)

        # Zones (use user preferences or default zones as fallback)
        power_zones_raw = prefs.get('power_zones')
        if not power_zones_raw or not isinstance(power_zones_raw, list):
            power_zones_raw = DEFAULT_POWER_ZONES_LIST
        hr_zones_raw = prefs.get('hr_zones')
        if not hr_zones_raw or not isinstance(hr_zones_raw, list):
            hr_zones_raw = DEFAULT_HR_ZONES_LIST
        t_power = {z['name']: 0 for z in power_zones_raw}
        t_hr = {z['name']: 0 for z in hr_zones_raw}
        if powers:
            for p in powers:
                for z in power_zones_raw:
                    if z['min'] <= p <= z['max']: t_power[z['name']] += 1; break
        if hrs:
            for h in hrs:
                for z in hr_zones_raw:
                    if z['min'] <= h <= z['max']: t_hr[z['name']] += 1; break

        # Fetch Laps
        cursor.execute(f"SELECT lap_number, start_time, total_elapsed_time, total_distance, avg_speed, max_speed, avg_heart_rate, max_heart_rate FROM {DATABASE_SCHEMA}.laps WHERE activity_id = %s AND user_id = %s ORDER BY lap_number ASC", (activity_id, user_id))
        laps = []
        for l in cursor.fetchall():
            laps.append({"number": l[0], "start_time": str(l[1]), "duration_min": round(l[2] / 60, 1), "distance_km": round(l[3] / 1000, 2), "avg_speed": round(l[4] * 3.6, 1) if l[4] else 0, "max_speed": round(l[5] * 3.6, 1) if l[5] else 0, "avg_hr": l[6], "max_hr": l[7]})

        # W'bal calculation (cycling only, with power data)
        w_bal_data = []
        w_prime_est = None
        if sport in cycling_sports and powers and ftp > 0:
            mmp_data = activity.get('mmp_data', {})
            try:
                w_prime_est = estimate_w_prime(mmp_data, ftp) if mmp_data else None
            except Exception:
                w_prime_est = None
            # Need full-length power arrray aligned with records
            powers_for_wbal = [r['power'] for r in records]
            try:
                w_bal_data = calculate_w_bal(powers_for_wbal, ftp, w_prime_est)
            except Exception:
                w_bal_data = []
            # Downsample to ~500 points for frontend
            if len(w_bal_data) > 500:
                step = len(w_bal_data) // 500
                w_bal_data = w_bal_data[::step]

        return {
            "activity": activity, "records": records, "laps": laps,
            "time_in_power_zones": {k: {"min": round(v/60, 1), "pct": round(v/max(len(powers),1)*100, 1)} for k,v in t_power.items()},
            "time_in_hr_zones": {k: {"min": round(v/60, 1), "pct": round(v/max(len(hrs),1)*100, 1)} for k,v in t_hr.items()},
            "power_zone_ranges": {z['name']: [z['min'], z['max']] for z in power_zones_raw},
            "hr_zone_ranges": {z['name']: [z['min'], z['max']] for z in hr_zones_raw},
            "w_bal_data": w_bal_data,
            "w_prime_est": w_prime_est,
            "cardiac_drift_pct": round(float(cardiac_drift), 1) if cardiac_drift is not None else None,
            "cadence_stats": _cadence_stats(cadences),
            "best_efforts": _best_efforts(records, sport),
            "enriched_context": _build_enriched_context(activity.get('raw_data'), sport),
        }


def get_efficiency_factor(conn, user_id: str, months: int = 6) -> dict:
    """
    Calculates Efficiency Factor (EF = NP / avg_HR) for each cycling activity.
    Returns time series data for trend analysis.
    """
    prefs = fetch_user_preferences(conn, user_id)
    np_rolling = prefs.get('np_rolling_seconds', DEFAULT_NP_ROLLING_SECONDS)
    start_date = datetime.now() - timedelta(days=months * 30)
    
    # We need activities with both HR and Power
    df_activities, df_records = fetch_activities_for_user(conn, user_id, start_date)
    
    if df_records.empty:
        return {"dates": [], "values": [], "avg_power": [], "avg_hr": []}

    results = []
    activity_ids = tuple(df_activities.index.tolist())
    
    for act_id in activity_ids:
        act_records = df_records[df_records['activity_id'] == act_id]
        if act_records.empty: continue
        
        powers = act_records['power'].dropna()
        hrs = act_records['heart_rate'].dropna()
        
        # Filter: Only rides > 45 mins for stable EF
        if len(powers) < 2700 or len(hrs) < 2700: continue 
        
        # Calculate NP & Avg HR
        np_val = (powers.astype(float)**4).mean()**(1/4)
        avg_hr = hrs.mean()
        
        if np_val > 0 and avg_hr > 0:
            ef = np_val / avg_hr
            results.append({
                "date": df_activities.loc[act_id, 'start_time'].strftime('%Y-%m-%d'),
                "ef": round(float(ef), 3),
                "np": round(float(np_val), 0),
                "hr": round(float(avg_hr), 0)
            })

    if not results:
        return {"dates": [], "values": [], "trend": [], "avg_power": [], "avg_hr": []}

    df_res = pd.DataFrame(results)
    # 5-activity moving average for trend
    df_res['trend'] = df_res['ef'].rolling(window=5, min_periods=1).mean()

    return {
        "dates": df_res['date'].tolist(),
        "values": df_res['ef'].tolist(),
        "trend": [round(float(v), 3) for v in df_res['trend'].tolist()],
        "np": df_res['np'].tolist(),
        "hr": df_res['hr'].tolist()
    }


def get_period_intensity_distribution(conn, user_id: str, months: int = 6) -> dict:
    """Calculates total time in power and HR zones for the period."""
    prefs = fetch_user_preferences(conn, user_id)
    power_zones = prefs.get('power_zones')
    if not power_zones or not isinstance(power_zones, list):
        power_zones = DEFAULT_POWER_ZONES_LIST
    hr_zones = prefs.get('hr_zones')
    if not hr_zones or not isinstance(hr_zones, list):
        hr_zones = DEFAULT_HR_ZONES_LIST
    start_date = datetime.now() - timedelta(days=months * 30)
    df_activities, df_records = fetch_activities_for_user(conn, user_id, start_date)
    if df_records.empty:
        return {"power": {}, "hr": {}, "power_zone_ranges": {}, "hr_zone_ranges": {}}
    p_dist = {z['name']: 0 for z in power_zones}
    if 'power' in df_records.columns:
        for p in df_records['power'].dropna():
            for z in power_zones:
                if z['min'] <= p <= z['max']: p_dist[z['name']] += 1; break
    h_dist = {z['name']: 0 for z in hr_zones}
    if 'heart_rate' in df_records.columns:
        for h in df_records['heart_rate'].dropna():
            for z in hr_zones:
                if z['min'] <= h <= z['max']: h_dist[z['name']] += 1; break
    tp, th = sum(p_dist.values()) or 1, sum(h_dist.values()) or 1
    return {
        "power": {k: {"min": round(v/60, 1), "pct": round(v/tp*100, 1)} for k,v in p_dist.items()},
        "hr": {k: {"min": round(v/60, 1), "pct": round(v/th*100, 1)} for k,v in h_dist.items()},
        "power_zone_ranges": {z['name']: [z['min'], z['max']] for z in power_zones},
        "hr_zone_ranges": {z['name']: [z['min'], z['max']] for z in hr_zones}
    }


def get_vo2max_history(conn, user_id: str, months: int = 6) -> dict:
    """
    Estimates VO2 Max using the original rIAcardo 1.0 formula.
    VO2 (mL/kg/min) = ((FTP / 0.83) * 10.8 / weight) + 7
    Weighted by CTL trend for realistic evolution.
    """
    prefs = fetch_user_preferences(conn, user_id)
    ftp = prefs.get('ftp', 270)
    weight = prefs.get('weight', 88)
    if weight <= 0 or ftp <= 0: return {"dates": [], "values": [], "current": 0}

    base_vo2 = ((ftp / 0.83) * 10.8 / weight) + 7
    load_data = get_training_load(conn, user_id, months)
    
    if not load_data.get('dates'):
        return {"dates": [], "values": [], "current": round(base_vo2, 1)}

    dates = load_data['dates']
    ctl_values = load_data['ctl']
    max_ctl = max(ctl_values) if ctl_values else 80
    if max_ctl < 40: max_ctl = 80
    
    evolution = []
    for ctl in ctl_values:
        # Range: 92% to 100% of base VO2 max depending on fitness
        factor = 0.92 + (0.08 * (ctl / max_ctl))
        evolution.append(round(base_vo2 * factor, 1))

    return {"dates": dates, "values": evolution, "current": evolution[-1] if evolution else round(base_vo2, 1)}


def get_volume_analysis(conn, user_id: str, months: int = 6, grouping: str = 'week') -> dict:
    """
    Calculates total TSS and training hours grouped by week or month.
    """
    start_date = datetime.now() - timedelta(days=months * 30)
    # Reuse fetch_activities_for_user but we only need summary data
    df_activities, _ = fetch_activities_for_user(conn, user_id, start_date)
    
    if df_activities.empty:
        return {"labels": [], "tss": [], "hours": []}

    # Calculate TSS for each activity (simplified for speed)
    prefs = fetch_user_preferences(conn, user_id)
    ftp = prefs.get('ftp', 270)
    
    df = df_activities.copy()
    # Estimate TSS if not present (using a very basic avg power if possible, or just 0)
    # For now, we'll assume TSS is calculated in training_load and we'll reuse that logic
    # But to be clean, let's just use the durations and a placeholder for now 
    # OR we could call get_training_load internally.
    
    # Better: use the same logic as get_training_load but grouped
    load_data = get_training_load(conn, user_id, months)
    df_tss = pd.DataFrame({
        'date': pd.to_datetime(load_data['dates']),
        'tss': load_data['daily_tss']
    })
    
    # Get hours directly from activities
    df_act = df_activities.reset_index()
    df_act['date'] = pd.to_datetime(df_act['start_time']).dt.date
    df_act['hours'] = df_act['total_elapsed_time'] / 3600
    
    # Merge TSS and Hours
    df_act_daily = df_act.groupby('date')['hours'].sum().reset_index()
    df_act_daily['date'] = pd.to_datetime(df_act_daily['date'])
    df_tss['date'] = pd.to_datetime(df_tss['date'])
    
    df_daily = df_tss.merge(df_act_daily, on='date', how='left').fillna(0)

    if grouping == 'month':
        df_grouped = df_daily.groupby(df_daily['date'].dt.to_period('M')).agg({'tss': 'sum', 'hours': 'sum'})
        labels = [str(p) for p in df_grouped.index]
    else: # week
        df_grouped = df_daily.groupby(df_daily['date'].dt.to_period('W')).agg({'tss': 'sum', 'hours': 'sum'})
        labels = [f"W{p.week} {p.start_time.strftime('%b')}" for p in df_grouped.index]

    return {
        "labels": labels,
        "tss": [round(v, 0) for v in df_grouped['tss'].tolist()],
        "hours": [round(v, 1) for v in df_grouped['hours'].tolist()]
    }


def update_activity_mmp_settings(conn, user_id: str, activity_id: int, ignore_mmp: bool) -> dict:
    """Updates the ignore_mmp flag for a specific activity."""
    with conn.cursor() as cursor:
        cursor.execute(f"UPDATE {DATABASE_SCHEMA}.activities SET ignore_mmp = %s WHERE activity_id = %s AND user_id = %s", (ignore_mmp, activity_id, user_id))
    conn.commit()
    return {"status": "success", "activity_id": activity_id, "ignore_mmp": ignore_mmp}


def get_comprehensive_report_data(conn, user_id: str, months: int = 3) -> dict:
    """
    Gathers ALL data needed for a high-quality AI coach report.
    Combines: Training Load, MMP, Efficiency Factor, VO2Max, Volume, Intensity Distribution.
    """
    # 1. Training Load (CTL/ATL/TSB, daily TSS, activities list)
    load = get_training_load(conn, user_id, months)
    
    # 2. MMP Curve (current period vs all-time)
    mmp = get_mmp_data(conn, user_id, months)
    
    # 3. Efficiency Factor trend
    ef = get_efficiency_factor(conn, user_id, months)
    
    # 4. VO2Max History
    vo2 = get_vo2max_history(conn, user_id, months)
    
    # 5. Volume Analysis (weekly TSS + hours)
    volume = get_volume_analysis(conn, user_id, months, 'week')
    
    # 6. Intensity Distribution (power and HR zones)
    intensity = get_period_intensity_distribution(conn, user_id, months)
    
    # 7. Recent activities (top 10 by TSS, most recent first)
    all_activities = load.get('activities', []) if 'activities' in load else []
    # Sort by date descending, then by TSS descending
    all_activities_sorted = sorted(all_activities, key=lambda x: (x.get('date', ''), x.get('tss', 0)), reverse=True)
    recent_activities = all_activities_sorted[:10]

    # 7b. Volume/TSS breakdown per sport group
    sport_breakdown = _summarize_by_sport(all_activities)

    # 7c. Rest days and weekly monotony
    load_balance = _rest_and_monotony(load.get('dates'), load.get('daily_tss'))

    # 7d. Thresholds (FTP history, LTHR, threshold pace, weight)
    try:
        thresholds = get_thresholds_history(conn, user_id)
    except Exception as e:
        print(f"[REPORT] thresholds error: {e}")
        thresholds = {}

    # 7e. Latest per-activity analyses for continuity
    try:
        recent_analyses = get_recent_activity_analyses(conn, user_id, limit=3)
    except Exception as e:
        print(f"[REPORT] recent analyses error: {e}")
        recent_analyses = []

    # 8. Compliance: planned vs actual for recent weeks
    compliance = []
    try:
        from api.services.coach_service import get_weekly_tss_comparison
        from datetime import datetime, timedelta
        today = datetime.now().date()
        for i in range(4):  # Last 4 weeks
            week_start = today - timedelta(days=today.weekday() + 7*i)
            week_str = week_start.strftime('%Y-%m-%d')
            try:
                comp = get_weekly_tss_comparison(conn, user_id, week_str)
                compliance.append({
                    "week_start": week_str,
                    "planned_tss": comp.get('planned_tss', 0),
                    "actual_tss": comp.get('actual_tss', 0),
                    "compliance_pct": comp.get('compliance_pct', 0)
                })
            except: pass
    except: pass
    
    return {
        "training_load": load,
        "mmp_curve": mmp,
        "efficiency_factor": ef,
        "vo2max_history": vo2,
        "volume": volume,
        "intensity_distribution": intensity,
        "recent_activities": recent_activities,
        "sport_breakdown": sport_breakdown,
        "load_balance": load_balance,
        "thresholds": thresholds,
        "recent_activity_analyses": recent_analyses,
        "compliance": compliance,
    }


def get_activities_list(conn, user_id: str, start_date: datetime, end_date: datetime) -> list:
    """Returns a simple list of activities for a date range optimized for calendar view."""
    prefs = fetch_user_preferences(conn, user_id)
    ftp = prefs.get('ftp', DEFAULT_FTP)
    lthr = prefs.get('lthr', DEFAULT_LTHR)
    threshold_pace = prefs.get('threshold_pace', 0)

    # Convert to strings for the SQL query to avoid timezone confusion in comparison
    start_str = start_date.strftime('%Y-%m-%d 00:00:00')
    end_str = end_date.strftime('%Y-%m-%d 23:59:59')

    with conn.cursor() as cursor:
        query = f"""
            SELECT activity_id, start_time, total_elapsed_time, total_distance, 
                   total_ascent, sport, avg_heart_rate, avg_speed, detected_metrics
            FROM {DATABASE_SCHEMA}.activities 
            WHERE user_id = %s AND start_time >= %s AND start_time <= %s AND ignore_mmp = FALSE
            ORDER BY start_time DESC
        """
        cursor.execute(query, (user_id, start_str, end_str))
        rows = cursor.fetchall()
    
    if not rows: return []

    activities = []
    for row in rows:
        act_id, start_time, duration, distance, ascent, sport, avg_hr, avg_speed_ms, detected_metrics = row
        
        # Check if TSS is pre-calculated in detected_metrics
        stored_metrics = detected_metrics if isinstance(detected_metrics, dict) else (json.loads(detected_metrics) if detected_metrics else {})
        tss = stored_metrics.get('tss')

        if tss is None:
            tss = calculate_activity_tss(
                duration, sport,
                avg_hr=avg_hr, lthr=lthr,
                avg_speed=avg_speed_ms, threshold_pace=threshold_pace
            )

        activities.append({
            "activity_id": int(act_id),
            "date": start_time.strftime('%Y-%m-%d'),
            "start_time": start_time.isoformat(),
            "sport": sport,
            "duration_min": round(duration / 60, 0),
            "distance_km": round(distance / 1000, 1),
            "ascent_m": ascent,
            "tss": round(float(tss or 0), 1)
        })
    
    return activities

"""Automatic planning schedule: preferences and due-date logic.

The athlete can opt into automatic plan generation. On a chosen day of the week
(at a fixed server hour) the coach report and the next 7-day plan are generated
automatically. Preferences live in the generic ``public.user_preferences``
key/value table, so no schema change is required.
"""

import os
from datetime import date, datetime, timedelta

DATABASE_SCHEMA = "public"

VALID_CADENCES = ("weekly", "biweekly")
CADENCE_INTERVAL_DAYS = {"weekly": 7, "biweekly": 14}
DEFAULT_CADENCE = "weekly"
DEFAULT_DAY = 0  # Monday
DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


class PlanningValidationError(ValueError):
    """Raised when the submitted planning preferences are invalid."""


def generation_hour() -> int:
    """Fixed server hour (0-23) at which the daily generation job runs."""
    try:
        hour = int(os.getenv("PLAN_GENERATION_HOUR", "6"))
    except (TypeError, ValueError):
        return 6
    return min(max(hour, 0), 23)


def _as_bool(value) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _parse_last_run(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)).date()
    except (TypeError, ValueError):
        return None


def last_scheduled_on_or_before(day: int, ref: date) -> date:
    """Most recent occurrence of ``day`` (0=Monday) on or before ``ref``."""
    return ref - timedelta(days=(ref.weekday() - day) % 7)


def is_due(cadence: str, day: int, last_run, today: date) -> bool:
    """Whether a plan is due ``today`` for the given schedule."""
    interval = CADENCE_INTERVAL_DAYS.get(cadence, CADENCE_INTERVAL_DAYS[DEFAULT_CADENCE])
    if last_run is None:
        # First run: wait for the chosen weekday instead of firing immediately.
        return today.weekday() == day
    last_scheduled = last_scheduled_on_or_before(day, today)
    return (last_scheduled - last_run).days >= interval


def next_run_date(cadence: str, day: int, last_run, today: date) -> date:
    """Next date on which a plan will be generated (``today`` if already due)."""
    if is_due(cadence, day, last_run, today):
        return today
    if last_run is None:
        return today + timedelta(days=(day - today.weekday()) % 7)

    interval = CADENCE_INTERVAL_DAYS.get(cadence, CADENCE_INTERVAL_DAYS[DEFAULT_CADENCE])
    # First occurrence of the chosen weekday after the last run...
    nxt = last_run + timedelta(days=((day - last_run.weekday()) % 7) or 7)
    # ...then advance by whole weeks until the cadence interval is met.
    while (nxt - last_run).days < interval:
        nxt += timedelta(days=7)
    return nxt


def _load_plan_prefs(conn, user_id: str) -> dict:
    with conn.cursor() as cursor:
        cursor.execute(
            f"SELECT preference_key, preference_value FROM {DATABASE_SCHEMA}.user_preferences WHERE user_id = %s",
            (user_id,),
        )
        prefs = dict(cursor.fetchall())
    return {k: v for k, v in prefs.items() if k.startswith("plan_")}


def get_plan_schedule(conn, user_id: str) -> dict:
    """Returns the automatic planning schedule for a user (with defaults)."""
    prefs = _load_plan_prefs(conn, user_id)

    cadence = prefs.get("plan_cadence", DEFAULT_CADENCE)
    if cadence not in VALID_CADENCES:
        cadence = DEFAULT_CADENCE

    try:
        day = int(prefs.get("plan_day", DEFAULT_DAY))
    except (TypeError, ValueError):
        day = DEFAULT_DAY
    if day < 0 or day > 6:
        day = DEFAULT_DAY

    last_run = _parse_last_run(prefs.get("plan_last_run"))
    today = datetime.now().date()

    return {
        "enabled": _as_bool(prefs.get("plan_enabled", "false")),
        "cadence": cadence,
        "day": day,
        "day_name": DAY_NAMES[day],
        "hour": generation_hour(),
        "last_run": last_run.isoformat() if last_run else None,
        "next_run": next_run_date(cadence, day, last_run, today).isoformat(),
    }


def update_plan_schedule(conn, user_id: str, payload: dict) -> dict:
    """Validates and persists the automatic planning preferences."""
    if not isinstance(payload, dict):
        raise PlanningValidationError("Expected a JSON object.")

    enabled = payload.get("enabled")
    cadence = payload.get("cadence", DEFAULT_CADENCE)
    day = payload.get("day", DEFAULT_DAY)

    if not isinstance(enabled, bool):
        raise PlanningValidationError("'enabled' must be a boolean.")
    if cadence not in VALID_CADENCES:
        raise PlanningValidationError(f"'cadence' must be one of {list(VALID_CADENCES)}.")
    try:
        day = int(day)
    except (TypeError, ValueError):
        raise PlanningValidationError("'day' must be an integer between 0 (Monday) and 6 (Sunday).")
    if day < 0 or day > 6:
        raise PlanningValidationError("'day' must be an integer between 0 (Monday) and 6 (Sunday).")

    values = {
        "plan_enabled": "true" if enabled else "false",
        "plan_cadence": cadence,
        "plan_day": str(day),
    }
    with conn.cursor() as cursor:
        for key, value in values.items():
            cursor.execute(
                f"""INSERT INTO {DATABASE_SCHEMA}.user_preferences (user_id, preference_key, preference_value)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id, preference_key)
                    DO UPDATE SET preference_value = EXCLUDED.preference_value""",
                (user_id, key, value),
            )
    conn.commit()
    return get_plan_schedule(conn, user_id)


def mark_plan_generated(conn, user_id: str, when: datetime = None) -> None:
    """Records that a plan was generated now (used for idempotency/catch-up)."""
    when = when or datetime.now()
    with conn.cursor() as cursor:
        cursor.execute(
            f"""INSERT INTO {DATABASE_SCHEMA}.user_preferences (user_id, preference_key, preference_value)
                VALUES (%s, 'plan_last_run', %s)
                ON CONFLICT (user_id, preference_key)
                DO UPDATE SET preference_value = EXCLUDED.preference_value""",
            (user_id, when.isoformat()),
        )
    conn.commit()

"""In-process scheduler that generates the plan automatically.

On the day of the week chosen by each athlete (at a fixed server hour) the
coach report and the next 7-day plan are generated, and an in-app notification
is created so the user knows their new plan is ready.

The scheduler runs inside the FastAPI process (single uvicorn worker). Set
``SCHEDULER_ENABLED=false`` to disable it (e.g. tests or CI).
"""

import asyncio
import os
from datetime import datetime, timedelta

from api.dependencies.database import get_db_connection
from api.services.planning_service import (
    get_plan_schedule,
    is_due,
    mark_plan_generated,
    generation_hour,
)
from api.services.notification_service import create_notification

_scheduler = None
_run_lock = asyncio.Lock()

PLAN_NOTIFICATION_TITLE = "Tu informe y plan están listos"
PLAN_NOTIFICATION_MESSAGE = (
    "El coach IA ha generado tu nuevo informe y el plan de entrenamiento del próximo ciclo."
)


def scheduler_enabled() -> bool:
    return os.getenv("SCHEDULER_ENABLED", "true").strip().lower() not in ("0", "false", "no", "off")


def _enabled_user_ids(conn) -> list:
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT user_id FROM public.user_preferences "
            "WHERE preference_key = 'plan_enabled' "
            "AND lower(preference_value) IN ('true', '1', 'yes', 'on')"
        )
        return [row[0] for row in cursor.fetchall()]


async def _generate_for_user(conn, user_id: str) -> bool:
    """Generates the report + plan for one user and notifies them. Best-effort."""
    from api.services.coach_service import generate_coach_report

    result = await generate_coach_report(conn, user_id)
    if result.get("error"):
        print(f"[SCHEDULER] Plan generation failed for {user_id}: {result['error']}")
        return False

    mark_plan_generated(conn, user_id)
    create_notification(
        conn,
        user_id,
        PLAN_NOTIFICATION_TITLE,
        PLAN_NOTIFICATION_MESSAGE,
        type_="report",
        link="/coach",
    )
    return True


async def run_due_plans() -> int:
    """Generates plans for every athlete whose schedule is due today.

    Idempotent: a user is only processed once per scheduling period, and the
    run is serialized so overlapping triggers cannot double-generate.
    """
    if _run_lock.locked():
        print("[SCHEDULER] A generation run is already in progress, skipping.")
        return 0

    async with _run_lock:
        conn = get_db_connection()
        if not conn:
            print("[SCHEDULER] No database connection, skipping run.")
            return 0

        generated = 0
        today = datetime.now().date()
        try:
            for user_id in _enabled_user_ids(conn):
                try:
                    schedule = get_plan_schedule(conn, user_id)
                    if not schedule["enabled"]:
                        continue

                    last_run = None
                    if schedule["last_run"]:
                        last_run = datetime.fromisoformat(schedule["last_run"]).date()
                    if not is_due(schedule["cadence"], schedule["day"], last_run, today):
                        continue

                    if await _generate_for_user(conn, user_id):
                        generated += 1
                except Exception as e:
                    conn.rollback()
                    print(f"[SCHEDULER] Error processing user {user_id}: {e}")
        finally:
            conn.close()

        if generated:
            print(f"[SCHEDULER] Generated {generated} plan(s).")
        return generated


def start_scheduler():
    """Starts the in-process scheduler. Returns the scheduler or None."""
    global _scheduler

    if not scheduler_enabled():
        print("[SCHEDULER] Disabled via SCHEDULER_ENABLED.")
        return None
    if _scheduler and _scheduler.running:
        return _scheduler

    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.triggers.date import DateTrigger

    hour = generation_hour()
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        run_due_plans,
        CronTrigger(hour=hour, minute=0),
        id="auto_plan_daily",
        replace_existing=True,
        max_instances=1,
    )
    # Catch-up: if the server was down at the scheduled hour, run soon after boot.
    _scheduler.add_job(
        run_due_plans,
        DateTrigger(run_date=datetime.now() + timedelta(seconds=45)),
        id="auto_plan_catchup",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    print(f"[SCHEDULER] Started (daily generation at {hour:02d}:00).")
    return _scheduler


def shutdown_scheduler():
    """Stops the scheduler if running."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        print("[SCHEDULER] Stopped.")
    _scheduler = None

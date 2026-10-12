"""
Garmin Connect data ingestion service with background worker support.
"""
import json
import time
import asyncio
from datetime import datetime, timedelta, timezone
import pandas as pd

from api.services.garmin_service import (
    garmin_login,
    garmin_login_with_token,
    fetch_activities,
    fetch_activity_detail,
    fetch_activity_details,
    fetch_activity_fit,
)
from api.dependencies.database import get_db_connection
from api.dependencies.crypto import decrypt
from api.services.core_calculations import get_mmp_curve

DATABASE_SCHEMA = "public"


def _is_running_sport(sport) -> bool:
    """True for running-like sports (Garmin slang included)."""
    if not sport:
        return False
    s = str(sport).lower()
    return 'run' in s or 'trail' in s or 'carrera' in s


def _normalize_cadence(sport, cadence):
    """
    Garmin/FIT stores running cadence per leg (half of the real strides per
    minute). Cycling cadence is stored as-is. Returns the display cadence.
    """
    if cadence is None:
        return None
    if _is_running_sport(sport):
        return cadence * 2
    return cadence


def _get_activity_sport(conn, activity_id):
    """Returns the sport string for an activity (or None)."""
    with conn.cursor() as cursor:
        cursor.execute(
            f"SELECT sport FROM {DATABASE_SCHEMA}.activities WHERE activity_id = %s",
            (activity_id,)
        )
        row = cursor.fetchone()
        return row[0] if row else None


def update_activity_mmp(conn, activity_id, mmp_data):
    """Updates the mmp_data column for a specific activity."""
    with conn.cursor() as cursor:
        cursor.execute(
            f"UPDATE {DATABASE_SCHEMA}.activities SET mmp_data = %s WHERE activity_id = %s",
            (json.dumps(mmp_data), activity_id)
        )
    conn.commit()

def update_user_sync_status(user_id, status, error=None, history_synced=None):
    """Updates the sync status of a user in the database."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if history_synced is not None:
                cursor.execute(
                    f"UPDATE {DATABASE_SCHEMA}.users SET sync_status = %s, sync_error = %s, history_synced = %s WHERE user_id = %s",
                    (status, error, history_synced, user_id)
                )
            else:
                cursor.execute(
                    f"UPDATE {DATABASE_SCHEMA}.users SET sync_status = %s, sync_error = %s WHERE user_id = %s",
                    (status, error, user_id)
                )
        conn.commit()
    finally:
        conn.close()

def get_sync_status(user_id):
    """Retrieves the current sync status from the database."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT sync_status FROM public.users WHERE user_id = %s", (user_id,))
            row = cursor.fetchone()
            return row[0] if row else None
    finally:
        conn.close()

def get_max_activity_timestamp(conn, user_id):
    """Returns the start_time of the most recent activity for a user."""
    with conn.cursor() as cursor:
        cursor.execute(f"SELECT MAX(start_time) FROM {DATABASE_SCHEMA}.activities WHERE user_id = %s", (user_id,))
        res = cursor.fetchone()[0]
        return int(res.timestamp()) if res else None

def get_min_activity_timestamp(conn, user_id):
    """Returns the start_time of the oldest activity for a user."""
    with conn.cursor() as cursor:
        cursor.execute(f"SELECT MIN(start_time) FROM {DATABASE_SCHEMA}.activities WHERE user_id = %s", (user_id,))
        res = cursor.fetchone()[0]
        return int(res.timestamp()) if res else None

def check_activity_exists(conn, garmin_activity_id, user_id):
    """Checks if an activity already exists in the database."""
    with conn.cursor() as cursor:
        cursor.execute(f"SELECT activity_id FROM {DATABASE_SCHEMA}.activities WHERE garmin_activity_id = %s AND user_id = %s", (str(garmin_activity_id), user_id))
        return cursor.fetchone() is not None

def insert_activity(conn, user_id, garmin_id, activity_data):
    """Inserts an activity into the database and returns its internal ID."""
    sport = activity_data.get('activityType', {}).get('typeKey', 'unknown')
    start_time = activity_data.get('startTimeLocal') or activity_data.get('startTimeGMT')
    tz = None
    tz_info = activity_data.get('timeZoneUnitDTO')
    if tz_info:
        tz = tz_info.get('timeZone') or tz_info.get('unitKey')

    with conn.cursor() as cursor:
        cursor.execute(f"""
            INSERT INTO {DATABASE_SCHEMA}.activities 
            (user_id, garmin_activity_id, start_time, total_elapsed_time, moving_time, total_distance,
             total_ascent, total_descent, total_calories, avg_speed, max_speed,
             avg_heart_rate, max_heart_rate, sport, timezone, start_date_local, session_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING activity_id
        """, (
            user_id, str(garmin_id),
            start_time,
            activity_data.get('duration', 0),
            activity_data.get('movingDuration', 0),
            activity_data.get('distance', 0),
            activity_data.get('elevationGain', 0),
            activity_data.get('elevationLoss', 0),
            activity_data.get('calories', 0),
            activity_data.get('averageSpeed', 0),
            activity_data.get('maxSpeed', 0),
            activity_data.get('averageHR', 0),
            activity_data.get('maxHR', 0),
            sport,
            tz,
            start_time,
            json.dumps(activity_data)
        ))
        return cursor.fetchone()[0]


def insert_records_from_detail(conn, user_id, activity_id, activity_detail):
    """
    Inserts per-second records from Garmin get_activity_details() response.
    Maps metricDescriptors indices to record columns.
    """
    metrics_list = activity_detail.get('activityDetailMetrics', [])
    descriptors = activity_detail.get('metricDescriptors', [])
    if not metrics_list or not descriptors:
        return

    # Build index map: metric key -> position in metrics array
    idx_map = {}
    for d in descriptors:
        idx_map[d['key']] = d['metricsIndex']

    # Required indices
    ts_idx = idx_map.get('directTimestamp')
    lat_idx = idx_map.get('directLatitude')
    lng_idx = idx_map.get('directLongitude')
    alt_idx = idx_map.get('directElevation')
    hr_idx = idx_map.get('directHeartRate')
    speed_idx = idx_map.get('directSpeed')
    dist_idx = idx_map.get('sumDistance')
    cadence_idx = idx_map.get('directRunCadence')
    double_cadence_idx = idx_map.get('directDoubleCadence')

    if ts_idx is None:
        return

    sport = _get_activity_sport(conn, activity_id)

    records = []
    for m in metrics_list:
        vals = m.get('metrics', [])
        if not vals or len(vals) <= ts_idx:
            continue
        ts_ms = vals[ts_idx]
        if ts_ms is None or ts_ms == 0:
            continue

        from datetime import datetime, timezone
        ts = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)

        def safe_val(idx):
            if idx is None or idx >= len(vals):
                return None
            v = vals[idx]
            return v if v is not None else None

        # Use double cadence for cycling, run cadence for running
        cadence = _normalize_cadence(sport, safe_val(double_cadence_idx) or safe_val(cadence_idx))

        records.append((
            activity_id,
            user_id,
            ts,
            safe_val(hr_idx),
            safe_val(speed_idx),
            cadence,
            safe_val(dist_idx),
            safe_val(alt_idx),
            safe_val(lat_idx),
            safe_val(lng_idx),
            None  # power - not available from API
        ))

    if not records:
        return

    with conn.cursor() as cursor:
        cursor.executemany(f"""
            INSERT INTO {DATABASE_SCHEMA}.records
            (activity_id, user_id, timestamp, heart_rate, speed, cadence, distance, altitude, position_lat, position_lng, power)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, records)
    conn.commit()


def insert_records_from_fit(conn, user_id, activity_id, fit_zip_bytes):
    """
    Parses a Garmin FIT file (ZIP) and inserts per-second records.
    This provides power and cadence data not available from the API.
    Overwrites existing records for this activity.
    """
    import tempfile
    import zipfile
    import os
    import fitparse

    tmp_zip = tempfile.mktemp(suffix='.zip')
    fit_path = None
    try:
        with open(tmp_zip, 'wb') as f:
            f.write(fit_zip_bytes)

        with zipfile.ZipFile(tmp_zip, 'r') as z:
            fit_files = [f for f in z.namelist() if f.endswith('.fit')]
            if not fit_files:
                print(f"[WORKER] No .fit file found in ZIP")
                return
            z.extract(fit_files[0], '/tmp/')
            fit_path = f'/tmp/{fit_files[0]}'

        fit = fitparse.FitFile(fit_path)

        sport = _get_activity_sport(conn, activity_id)

        # Delete existing API-sourced records for this activity (FIT is more accurate)
        with conn.cursor() as cursor:
            cursor.execute(f"DELETE FROM {DATABASE_SCHEMA}.records WHERE activity_id = %s AND user_id = %s", (activity_id, user_id))

        records = []
        for msg in fit.get_messages('record'):
            fields = {f.name: f.value for f in msg.fields}

            ts = fields.get('timestamp')
            if ts is None:
                continue

            raw_lat = fields.get('position_lat')
            raw_lng = fields.get('position_long')
            lat = raw_lat * (180.0 / 2**31) if raw_lat is not None else None
            lng = raw_lng * (180.0 / 2**31) if raw_lng is not None else None

            speed = fields.get('speed') or fields.get('enhanced_speed')
            altitude = fields.get('altitude') or fields.get('enhanced_altitude')

            records.append((
                activity_id,
                user_id,
                ts,
                fields.get('heart_rate'),
                speed,
                _normalize_cadence(sport, fields.get('cadence')),
                fields.get('distance'),
                altitude,
                lat,
                lng,
                fields.get('power')
            ))

        if records:
            with conn.cursor() as cursor:
                cursor.executemany(f"""
                    INSERT INTO {DATABASE_SCHEMA}.records
                    (activity_id, user_id, timestamp, heart_rate, speed, cadence, distance, altitude, position_lat, position_lng, power)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, records)
            conn.commit()
            print(f"[WORKER] Inserted {len(records)} records from FIT file")
        else:
            print(f"[WORKER] No records found in FIT file")

    except Exception as e:
        print(f"[WORKER] FIT parsing error: {e}")
    finally:
        for f in [tmp_zip, fit_path]:
            if f and os.path.exists(f):
                try: os.unlink(f)
                except: pass

async def resume_interrupted_syncs():
    """Called on server startup to resume any sync processes."""
    print("[INIT] Checking for interrupted syncs...")
    conn = get_db_connection()
    if not conn: return
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"SELECT user_id, sync_status FROM {DATABASE_SCHEMA}.users WHERE sync_status IN ('SYNCING', 'RATE_LIMITED')")
            interrupted = cursor.fetchall()
        for user_id, status in interrupted:
            user_id_str = str(user_id)
            print(f"[INIT] Resuming sync for user {user_id_str} (Previous status: {status})")
            asyncio.create_task(background_sync_worker(user_id_str))
    except Exception as e: print(f"[INIT] Error resuming syncs: {e}")
    finally: conn.close()

async def background_sync_worker(user_id: str, days_back: int = 30):
    """Background worker for Garmin Connect sync."""
    print(f"[WORKER] Starting Garmin sync for user {user_id}")
    update_user_sync_status(user_id, 'SYNCING')
    conn = None
    try:
        while True:
            status = get_sync_status(user_id)
            if status not in ('SYNCING', 'RATE_LIMITED'):
                print(f"[WORKER] Status is '{status}', stopping worker for user {user_id}")
                if conn: conn.close()
                return

            # Get Garmin credentials from DB
            conn = get_db_connection()
            if not conn:
                update_user_sync_status(user_id, 'ERROR', "DB connection failed")
                await asyncio.sleep(30); continue

            with conn.cursor() as cursor:
                cursor.execute("SELECT garmin_email, garmin_password FROM public.users WHERE user_id = %s", (user_id,))
                creds = cursor.fetchone()

            if not creds or not creds[0] or not creds[1]:
                update_user_sync_status(user_id, 'ERROR', "No Garmin credentials. Please connect Garmin.")
                print(f"[WORKER] No Garmin credentials for user {user_id}")
                conn.close(); return

            garmin_email, garmin_password_enc = creds
            garmin_password = decrypt(garmin_password_enc)

            try:
                # Login to Garmin (uses cached tokens if available)
                client = garmin_login(user_id, garmin_email, garmin_password)
            except GarminConnectAuthenticationError as e:
                update_user_sync_status(user_id, 'ERROR', f"Garmin auth error: {e}. Please check credentials.")
                print(f"[WORKER] Garmin auth error for user {user_id}: {e}")
                conn.close(); return
            except Exception as e:
                update_user_sync_status(user_id, 'ERROR', f"Garmin connection error: {e}")
                print(f"[WORKER] Garmin connection error for user {user_id}: {e}")
                conn.close(); await asyncio.sleep(30); continue

            try:
                last_ts = get_max_activity_timestamp(conn, user_id)

                # Calculate cutoff date: 1 day before the last activity to avoid gaps
                from datetime import datetime, timedelta, timezone
                if last_ts:
                    cutoff_dt = datetime.fromtimestamp(last_ts, tz=timezone.utc) - timedelta(days=1)
                    cutoff_str = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S')
                    print(f"[WORKER] Last activity timestamp: {cutoff_dt.isoformat()}, syncing newer activities")
                else:
                    cutoff_str = None
                    print(f"[WORKER] No existing activities, syncing full history")

                # Paginate through Garmin activities until we reach activities older than our last one
                PAGE_SIZE = 50
                start = 0
                total_new = 0
                total_skipped = 0
                reached_cutoff = False

                while not reached_cutoff:
                    # Check if user stopped sync
                    current_status = get_sync_status(user_id)
                    if current_status not in ('SYNCING', 'RATE_LIMITED'):
                        print(f"[WORKER] Sync stopped by user {user_id}")
                        conn.close(); return

                    print(f"[WORKER] Fetching activities (page start={start})")
                    activities = fetch_activities(client, start=start, limit=PAGE_SIZE)

                    if not activities:
                        print(f"[WORKER] No more activities from Garmin")
                        break

                    for activity in activities:
                        garmin_id = activity.get('activityId')
                        if not garmin_id: continue

                        # Check if this activity is older than our cutoff
                        act_start = activity.get('startTimeLocal') or activity.get('startTimeGMT')
                        if cutoff_str and act_start and act_start < cutoff_str:
                            print(f"[WORKER] Reached activities older than last sync ({act_start}), stopping pagination")
                            reached_cutoff = True
                            break

                        if check_activity_exists(conn, garmin_id, user_id):
                            total_skipped += 1
                            continue

                        try:
                            detail = fetch_activity_detail(client, garmin_id)
                            # Merge summary into top-level keys for insert_activity
                            summary = detail.get('summaryDTO', {})
                            activity_data = {**summary, 'activityType': detail.get('activityTypeDTO', {}), 'timeZoneUnitDTO': detail.get('timeZoneUnitDTO', {}), 'name': detail.get('activityName')}
                            internal_id = insert_activity(conn, user_id, garmin_id, activity_data)

                            if internal_id:
                                conn.commit()
                                # Try FIT file first (has power + cadence), fall back to API data
                                fit_ok = False
                                try:
                                    fit_zip = fetch_activity_fit(client, garmin_id)
                                    insert_records_from_fit(conn, user_id, internal_id, fit_zip)
                                    fit_ok = True
                                except Exception as e:
                                    print(f"[WORKER] FIT download failed for {garmin_id}: {e}")

                                if not fit_ok:
                                    try:
                                        details = fetch_activity_details(client, garmin_id)
                                        insert_records_from_detail(conn, user_id, internal_id, details)
                                    except Exception as e:
                                        print(f"[WORKER] API detail fetch failed for {garmin_id}: {e}")

                                total_new += 1
                                print(f"[WORKER] Synced activity {garmin_id} ({activity_data.get('activityType', {}).get('typeKey', '?')}) {'[FIT]' if fit_ok else '[API]'}")

                        except Exception as e:
                            print(f"[WORKER] Error syncing activity {garmin_id}: {e}")
                            continue

                        await asyncio.sleep(0.3)  # Rate limiting courtesy

                    start += PAGE_SIZE

                print(f"[WORKER] Sync done: {total_new} new, {total_skipped} skipped (already in DB)")
                update_user_sync_status(user_id, 'COMPLETED', history_synced=True)
                conn.close(); break

            except Exception as e:
                update_user_sync_status(user_id, 'ERROR', str(e))
                print(f"[WORKER] Error for user {user_id}: {e}")
                conn.close(); await asyncio.sleep(30); continue

    except Exception as e:
        update_user_sync_status(user_id, 'ERROR', f"Critical: {str(e)}")
        print(f"[WORKER] Critical error for user {user_id}: {e}")
        if conn:
            try: conn.close()
            except: pass

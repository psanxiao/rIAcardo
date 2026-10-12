import datetime
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from api.dependencies.database import get_db_connection
from api.services.config_service import get_app_config

SCOPES = ['https://www.googleapis.com/auth/calendar']

def get_google_service():
    """Returns a Google Calendar service using the global app config."""
    conn = get_db_connection()
    if not conn: return None
    try:
        json_str = get_app_config(conn, 'google_service_account_json')
        if not json_str: 
            print("[CALENDAR] No google_service_account_json found in app_config")
            return None
        
        json_key = json.loads(json_str)
        creds = service_account.Credentials.from_service_account_info(json_key, scopes=SCOPES)
        return build('calendar', 'v3', credentials=creds)
    finally:
        conn.close()

def clear_user_calendar(service, calendar_id):
    """Clears all future events with the [rIAcardo] tag from Google Calendar."""
    if not service or not calendar_id: return

    try:
        now = datetime.datetime.utcnow().isoformat() + 'Z'
        print(f"[CALENDAR] Cleaning future events in {calendar_id}...")
        
        events_result = service.events().list(
            calendarId=calendar_id, 
            timeMin=now,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        deleted = 0
        for event in events:
            if "[rIAcardo]" in event.get('summary', ''):
                service.events().delete(calendarId=calendar_id, eventId=event['id']).execute()
                deleted += 1
        print(f"[CALENDAR] Deleted {deleted} old events.")
    except Exception as e:
        print(f"[CALENDAR ERROR] Cleanup failed: {e}")

def sync_plan_to_calendar(user_id, calendar_id, workouts):
    """Pushes a full list of workouts to Google Calendar in one session."""
    service = get_google_service()
    if not service:
        print("[CALENDAR] Could not initialize Google Service")
        return
    
    # 1. First, clear existing future events
    clear_user_calendar(service, calendar_id)

    # 2. Insert new workouts
    count = 0
    for w in workouts:
        try:
            dt_obj = w['date']
            if isinstance(dt_obj, str):
                dt_obj = datetime.datetime.strptime(dt_obj, '%Y-%m-%d')
            
            # Default to morning for weekends, evening for weekdays
            hour = 8 if dt_obj.weekday() >= 5 else 18
            
            start_time = dt_obj.replace(hour=hour, minute=0, second=0).isoformat() + "Z"
            end_time = dt_obj.replace(hour=hour + 1, minute=0, second=0).isoformat() + "Z"

            event = {
                'summary': f"{w['title']} [rIAcardo]",
                'description': f"{w['description']}\n\nTSS Previsto: {w['tss']}\nDuración: {w['duration']} min",
                'start': {'dateTime': start_time, 'timeZone': 'UTC'},
                'end': {'dateTime': end_time, 'timeZone': 'UTC'},
                'colorId': '1' if w['type'] == 'rest' else '2'
            }

            service.events().insert(calendarId=calendar_id, body=event).execute()
            count += 1
        except Exception as e:
            print(f"[CALENDAR ERROR] Failed to insert workout {w.get('title')}: {e}")
    
    print(f"[CALENDAR] Successfully synced {count} workouts to Google.")

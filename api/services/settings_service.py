import json
from api.dependencies.database import get_db_connection

def get_settings(conn, user_id: str) -> dict:
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT preference_key, preference_value FROM public.user_preferences WHERE user_id = %s",
            (user_id,)
        )
        prefs = {}
        for key, value in cursor.fetchall():
            prefs[key] = value

    # Provide defaults if not exist
    if 'ftp' not in prefs: prefs['ftp'] = "200"
    if 'lthr' not in prefs: prefs['lthr'] = "165"
    if 'age' not in prefs: prefs['age'] = "30"
    if 'weight' not in prefs: prefs['weight'] = "70"
    if 'athlete_context' not in prefs: prefs['athlete_context'] = "Atleta de resistencia"
    if 'athlete_goal' not in prefs: prefs['athlete_goal'] = "Mejorar la forma física"

    return prefs

def update_settings(conn, user_id: str, new_settings: dict) -> dict:
    from datetime import datetime
    with conn.cursor() as cursor:
        for key, value in new_settings.items():
            # Convert dict/list to json string if necessary
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            else:
                value = str(value)

            cursor.execute(
                """INSERT INTO public.user_preferences (user_id, preference_key, preference_value)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (user_id, preference_key)
                   DO UPDATE SET preference_value = EXCLUDED.preference_value""",
                (user_id, key, value)
            )
            
            # If FTP is being updated, record it in history
            if key == 'ftp':
                try:
                    ftp_val = int(value)
                    cursor.execute(
                        "INSERT INTO public.ftp_history (user_id, ftp_value, start_date) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                        (user_id, ftp_val, datetime.now())
                    )
                except:
                    pass
                    
    conn.commit()
    return {"status": "ok"}

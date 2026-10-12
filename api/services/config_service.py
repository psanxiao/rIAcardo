import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_SCHEMA = "public"

def get_app_config(conn, key):
    """
    Fetches a global application configuration value.
    Used by calendar_service and other services that need app-wide settings.
    """
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"SELECT config_value FROM {DATABASE_SCHEMA}.app_config WHERE config_key = %s",
                (key,)
            )
            result = cursor.fetchone()
            return result[0] if result else None
    except Exception as e:
        print(f"Error fetching app config '{key}': {e}")
        return None

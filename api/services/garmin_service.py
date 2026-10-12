"""
Garmin Connect integration service using SSO login (email/password).
Uses garminconnect library with tokenstore-based session persistence.
"""
import os
from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectConnectionError

TOKEN_DIR = os.path.expanduser("~/.garminconnect")


def get_token_path(user_id: str) -> str:
    """Returns the token file path for a specific user."""
    return os.path.join(TOKEN_DIR, str(user_id), "tokens.json")


def garmin_login(user_id: str, email: str, password: str) -> Garmin:
    """
    Logs into Garmin Connect using email/password.
    Reuses cached session tokens via tokenstore if available.
    Returns an authenticated Garmin client.
    """
    token_path = get_token_path(user_id)
    client = Garmin(email, password)

    # login() with tokenstore will load existing tokens if they exist,
    # or perform a fresh login and save tokens to the path
    client.login(tokenstore=token_path)
    print(f"[GARMIN] Session active for {email}")
    return client


def garmin_login_with_token(user_id: str) -> Garmin:
    """
    Restores a Garmin session from cached tokens.
    Returns None if no valid session exists.
    """
    token_path = get_token_path(user_id)
    if not os.path.exists(token_path):
        return None
    try:
        client = Garmin("", "")
        client.login(tokenstore=token_path)
        return client
    except Exception:
        return None


def garmin_logout(user_id: str):
    """Clears cached session tokens for a user."""
    token_path = get_token_path(user_id)
    token_dir = os.path.dirname(token_path)
    if os.path.exists(token_dir):
        import shutil
        shutil.rmtree(token_dir, ignore_errors=True)


def fetch_activities(client: Garmin, start: int = 0, limit: int = 50) -> list:
    """
    Fetches a list of activities from Garmin Connect.
    Returns activity summaries.
    """
    return client.get_activities(start, limit)


def fetch_activity_detail(client: Garmin, activity_id: str) -> dict:
    """
    Fetches full activity details including splits, HR zones, etc.
    """
    return client.get_activity(activity_id)


def fetch_activity_details(client: Garmin, activity_id: str) -> dict:
    """
    Fetches per-second measurement data (lat, lng, altitude, HR, speed, cadence).
    """
    return client.get_activity_details(activity_id)


def fetch_activity_gpx(client: Garmin, activity_id: str) -> bytes:
    """
    Downloads activity as GPX format.
    """
    return client.download_activity(activity_id, dl_fmt=client.ActivityDownloadFormat.GPX)


def fetch_activity_fit(client: Garmin, activity_id: str) -> bytes:
    """
    Downloads original activity data (usually FIT format in a ZIP).
    """
    return client.download_activity(activity_id, dl_fmt=client.ActivityDownloadFormat.ORIGINAL)

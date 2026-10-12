from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from api.dependencies.database import get_db_connection
from api.dependencies.auth import get_current_user
from api.services.settings_service import get_settings, update_settings

router = APIRouter(prefix="/api/settings", tags=["Settings"])

@router.get("")
def read_settings(user_id: str = Depends(get_current_user)):
    """Fetches user preferences."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        return get_settings(conn, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch settings: {str(e)}")
    finally:
        conn.close()

@router.post("")
def save_settings(new_settings: Dict[str, Any], user_id: str = Depends(get_current_user)):
    """Updates user preferences."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        return update_settings(conn, user_id, new_settings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")
    finally:
        conn.close()

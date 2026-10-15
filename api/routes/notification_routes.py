from fastapi import APIRouter, HTTPException, Depends, Query
from api.dependencies.database import get_db_connection
from api.dependencies.auth import get_current_user
from api.services.notification_service import (
    list_notifications,
    count_unread,
    mark_as_read,
    mark_all_as_read,
)

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("")
def read_notifications(
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = False,
    user_id: str = Depends(get_current_user)
):
    """Returns the most recent in-app notifications for the user."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        return list_notifications(conn, user_id, limit=limit, unread_only=unread_only)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch notifications: {str(e)}")
    finally:
        conn.close()

@router.get("/unread-count")
def unread_count(user_id: str = Depends(get_current_user)):
    """Number of unread notifications (used by the header badge)."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        return {"unread": count_unread(conn, user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to count notifications: {str(e)}")
    finally:
        conn.close()

@router.post("/read-all")
def read_all_notifications(user_id: str = Depends(get_current_user)):
    """Marks every unread notification as read."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        return {"updated": mark_all_as_read(conn, user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update notifications: {str(e)}")
    finally:
        conn.close()

@router.post("/{notification_id}/read")
def read_notification(notification_id: int, user_id: str = Depends(get_current_user)):
    """Marks a single notification as read."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        if not mark_as_read(conn, user_id, notification_id):
            raise HTTPException(status_code=404, detail="Notification not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update notification: {str(e)}")
    finally:
        conn.close()

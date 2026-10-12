from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from pydantic import BaseModel
from api.dependencies.database import get_db_connection
from api.dependencies.auth import get_current_user
from api.dependencies.crypto import encrypt
from api.services.garmin_service import garmin_login, garmin_logout
from api.services.sync_service import background_sync_worker
from api.dependencies.limiter import limiter

router = APIRouter(prefix="/api/garmin", tags=["Garmin Integration"])

class GarminConnectRequest(BaseModel):
    email: str
    password: str

class SyncRequest(BaseModel):
    days_back: int = 30

@router.post("/connect")
def connect_garmin(request: GarminConnectRequest, user_id: str = Depends(get_current_user)):
    """Connects a Garmin account by validating credentials and storing them."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        # Try to login to validate credentials
        garmin_login(user_id, request.email, request.password)

        # Save credentials to DB (password encrypted)
        encrypted_pw = encrypt(request.password)
        with conn.cursor() as cursor:
            cursor.execute(
                """UPDATE public.users 
                   SET garmin_email = %s, garmin_password = %s, garmin_connected = TRUE
                   WHERE user_id = %s""",
                (request.email, encrypted_pw, user_id)
            )
        conn.commit()

        return {"status": "connected", "message": "Garmin Connect vinculado correctamente."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al conectar con Garmin: {str(e)}")
    finally:
        conn.close()

@router.post("/disconnect")
def disconnect_garmin(user_id: str = Depends(get_current_user)):
    """Disconnects Garmin account and clears stored credentials."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        garmin_logout(user_id)
        with conn.cursor() as cursor:
            cursor.execute(
                """UPDATE public.users 
                   SET garmin_email = NULL, garmin_password = NULL, garmin_connected = FALSE
                   WHERE user_id = %s""",
                (user_id,)
            )
        conn.commit()
        return {"status": "disconnected", "message": "Garmin desconectado."}
    finally:
        conn.close()

@router.get("/status")
def get_garmin_status(user_id: str = Depends(get_current_user)):
    """Returns the connection and sync status for Garmin."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT garmin_connected, garmin_email IS NOT NULL,
                          sync_status, history_synced, sync_error
                   FROM public.users WHERE user_id = %s""",
                (user_id,)
            )
            row = cursor.fetchone()
            if row:
                connected, has_email, sync_status, history_synced, sync_error = row
                return {
                    "connected": connected and has_email,
                    "sync_status": sync_status or 'IDLE',
                    "history_synced": history_synced,
                    "sync_error": sync_error
                }
            return {"connected": False, "sync_status": "IDLE"}
    finally:
        conn.close()

@router.post("/sync")
@limiter.limit("2/minute")
async def sync_garmin(
    request: Request,
    background_tasks: BackgroundTasks,
    sync_req: SyncRequest,
    user_id: str = Depends(get_current_user)
):
    """Triggers a background Garmin sync."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT sync_status FROM public.users WHERE user_id = %s", (user_id,))
            row = cursor.fetchone()
            if row and row[0] in ('SYNCING', 'RATE_LIMITED'):
                return {"status": "already_syncing", "message": "Sincronización ya en curso."}

        from api.services.sync_service import update_user_sync_status
        update_user_sync_status(user_id, 'SYNCING')

        background_tasks.add_task(background_sync_worker, user_id, sync_req.days_back)

        return {"status": "started", "message": "Sincronización iniciada en segundo plano."}
    finally:
        conn.close()

@router.post("/stop-sync")
async def stop_sync(user_id: str = Depends(get_current_user)):
    """Signals the background sync worker to stop."""
    from api.services.sync_service import update_user_sync_status
    update_user_sync_status(user_id, 'IDLE')
    return {"status": "stopping", "message": "Sincronización detenida."}

from fastapi import APIRouter, HTTPException, Depends, Query
from api.dependencies.database import get_db_connection
from api.dependencies.auth import get_current_user
from api.services.analysis_service import (
    get_training_load,
    get_mmp_data,
    get_efficiency_factor,
    get_activities_list,
    update_activity_mmp_settings,
    get_period_intensity_distribution,
    get_vo2max_history,
    get_activity_detail,
    get_volume_analysis,
    fetch_user_preferences,
)
from api.services.core_calculations import calculate_race_predictions

router = APIRouter(prefix="/api/analysis", tags=["Performance Analysis"])
...
@router.get("/volume")
def volume_analysis(
    months: int = Query(6, description="Number of months to analyze"),
    grouping: str = Query("week", regex="^(week|month)$"),
    user_id: str = Depends(get_current_user)
):
    """
    Returns TSS and hours training volume grouped by week or month.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        return get_volume_analysis(conn, user_id, months, grouping)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Volume analysis failed: {str(e)}")
    finally:
        conn.close()

@router.get("/training-load")
def training_load(
    months: int = Query(6, description="Number of months to analyze"),
    user_id: str = Depends(get_current_user)
):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        return get_training_load(conn, user_id, months)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        conn.close()

@router.get("/vo2max-history")
def vo2max_history(
    months: int = Query(6, description="Number of months to analyze"),
    user_id: str = Depends(get_current_user)
):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        return get_vo2max_history(conn, user_id, months)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        conn.close()

@router.get("/intensity-distribution")
def intensity_distribution(
    months: int = Query(6, description="Number of months to analyze"),
    user_id: str = Depends(get_current_user)
):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        return get_period_intensity_distribution(conn, user_id, months)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        conn.close()

@router.get("/mmp-curve")
def mmp_curve(
    months: int = Query(12, description="Period for MMP data in months"),
    user_id: str = Depends(get_current_user)
):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        return get_mmp_data(conn, user_id, months)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MMP analysis failed: {str(e)}")
    finally:
        conn.close()

@router.get("/efficiency-factor")
def efficiency_factor(
    months: int = Query(6, description="Period for EF data in months"),
    user_id: str = Depends(get_current_user)
):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        return get_efficiency_factor(conn, user_id, months)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EF analysis failed: {str(e)}")
    finally:
        conn.close()

@router.get("/activities")
def list_activities(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    user_id: str = Depends(get_current_user)
):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        from datetime import datetime
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        return get_activities_list(conn, user_id, start, end)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/activity/{activity_id}")
def activity_detail(
    activity_id: int,
    user_id: str = Depends(get_current_user)
):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        result = get_activity_detail(conn, user_id, activity_id)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except Exception as e:
        print(f"ERROR in activity_detail: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.patch("/activity/{activity_id}/mmp-settings")
def update_mmp_settings(
    activity_id: int,
    ignore_mmp: bool,
    user_id: str = Depends(get_current_user)
):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        return update_activity_mmp_settings(conn, user_id, activity_id, ignore_mmp)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/race-predictions")
def race_predictions(user_id: str = Depends(get_current_user)):
    """Returns predicted performance for key cycling durations and running distances."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        prefs = fetch_user_preferences(conn, user_id)
        ftp = prefs.get('ftp', 272)
        threshold_pace = prefs.get('threshold_pace', 0)
        return calculate_race_predictions(ftp, threshold_pace)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

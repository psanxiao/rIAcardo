from fastapi import APIRouter, HTTPException, Depends, Query, Request
from api.dependencies.database import get_db_connection
from api.dependencies.auth import get_current_user
from api.services.coach_service import (
    generate_coach_report,
    get_upcoming_workouts,
    analyze_single_activity,
    get_weekly_tss_comparison
)
from api.dependencies.limiter import limiter

router = APIRouter(prefix="/api/coach", tags=["Coach & AI"])

@router.get("/weekly-tss")
def weekly_tss_comparison(
    date: str = Query(..., description="Target date in the week (YYYY-MM-DD)"),
    user_id: str = Depends(get_current_user)
):
    """
    Returns planned vs actual TSS for the week.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        return get_weekly_tss_comparison(conn, user_id, date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/analyze-activity/{activity_id}")
@limiter.limit("10/minute")
async def analyze_activity(request: Request, activity_id: int, user_id: str = Depends(get_current_user)):
    """
    Analyzes a single activity using the AI coach.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        result = await analyze_single_activity(conn, user_id, activity_id)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/upcoming")
def upcoming_workouts(user_id: str = Depends(get_current_user)):
    """
    Returns the training plan for the next few days.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        return get_upcoming_workouts(conn, user_id)
    finally:
        conn.close()

@router.post("/generate-report")
@limiter.limit("10/minute")
async def generate_report(request: Request, user_id: str = Depends(get_current_user)):
    """
    Generates an AI coach report for the authenticated user using Groq.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        result = await generate_coach_report(conn, user_id)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Coach report generation failed: {str(e)}")
    finally:
        conn.close()

@router.get("/latest-report")
def get_latest_report(user_id: str = Depends(get_current_user)):
    """
    Retrieves the latest generated coach report from the database for the user.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT report_markdown, created_at, id 
                   FROM public.coach_reports 
                   WHERE user_id = %s 
                   ORDER BY created_at DESC LIMIT 1""",
                (user_id,)
            )
            row = cursor.fetchone()
            if row:
                return {"report": row[0], "date": str(row[1]), "id": row[2]}
            else:
                return {"report": None, "date": None, "id": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch report: {str(e)}")
    finally:
        conn.close()

@router.get("/history")
def get_report_history(user_id: str = Depends(get_current_user)):
    """
    Returns a list of all reports for the user.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT id, created_at FROM public.coach_reports 
                   WHERE user_id = %s ORDER BY created_at DESC""",
                (user_id,)
            )
            return [{"id": r[0], "date": str(r[1])} for r in cursor.fetchall()]
    finally:
        conn.close()

@router.get("/report/{report_id}")
def get_report_by_id(report_id: int, user_id: str = Depends(get_current_user)):
    """
    Fetches a specific report.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT report_markdown, created_at FROM public.coach_reports 
                   WHERE id = %s AND user_id = %s""",
                (report_id, user_id)
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Report not found")
            return {"report": row[0], "date": str(row[1])}
    finally:
        conn.close()

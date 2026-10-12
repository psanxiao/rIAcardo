import pytest
from fastapi.testclient import TestClient
from api.main import app
from api.dependencies.database import get_db_connection


@pytest.fixture(scope="module")
def client():
    """Provides a TestClient for the FastAPI app."""
    # Clean up test users before running the test suite
    conn = get_db_connection()
    if conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM public.users WHERE email LIKE '%@riacardo.dev'")
        conn.commit()
        conn.close()
    
    with TestClient(app) as c:
        yield c
    
    # Clean up test users after running the test suite
    conn = get_db_connection()
    if conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM public.users WHERE email LIKE '%@riacardo.dev'")
        conn.commit()
        conn.close()

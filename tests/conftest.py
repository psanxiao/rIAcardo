"""Shared pytest fixtures for the rIAcardo test suite."""

import os

# Provide a dummy Groq API key so the coach service doesn't abort on a fresh
# checkout (the actual Groq calls are mocked in the tests). This must be set
# before importing the app, because the coach service reads env vars at import
# time and python-dotenv does not override already-set variables.
os.environ.setdefault("GROQ_API_KEY", "test-groq-api-key")

import pytest
from fastapi.testclient import TestClient
from api.main import app
from api.dependencies.database import get_db_connection
from api.dependencies.limiter import limiter


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Clear the in-memory rate-limit storage before each test.

    The limiter storage is shared across the whole test session; without this,
    tests hitting the same rate-limited endpoint (e.g. /api/auth/login) can
    exhaust the window and fail with spurious 429 responses.
    """
    limiter.reset()
    yield
    limiter.reset()


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

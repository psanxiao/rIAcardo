"""Tests for the in-app notifications endpoints and service."""

from api.dependencies.database import get_db_connection
from api.services.notification_service import create_notification


def _register(client, email):
    resp = client.post("/api/auth/register", json={
        "email": email,
        "password": "testpassword",
    })
    assert resp.status_code == 201
    return resp.json()


def _login_token(client, email):
    resp = client.post("/api/auth/login", json={
        "email": email,
        "password": "testpassword",
    })
    return resp.json()["access_token"]


def test_notifications_require_auth(client):
    assert client.get("/api/notifications").status_code == 401
    assert client.get("/api/notifications/unread-count").status_code == 401
    assert client.post("/api/notifications/read-all").status_code == 401
    assert client.post("/api/notifications/1/read").status_code == 401


def test_notifications_lifecycle(client):
    email = "notified@riacardo.dev"
    user_id = _register(client, email)["user_id"]
    headers = {"Authorization": f"Bearer {_login_token(client, email)}"}

    # Empty at first.
    assert client.get("/api/notifications", headers=headers).json() == []
    assert client.get("/api/notifications/unread-count", headers=headers).json() == {"unread": 0}

    # Seed two notifications directly in the DB.
    conn = get_db_connection()
    try:
        first = create_notification(
            conn, user_id, "Informe listo", "Tu plan está disponible", type_="report", link="/coach"
        )
        create_notification(conn, user_id, "Bienvenido", None)
    finally:
        conn.close()

    listed = client.get("/api/notifications", headers=headers).json()
    assert len(listed) == 2
    assert listed[0]["title"] == "Bienvenido"
    assert listed[1]["id"] == first["id"]
    assert listed[1]["is_read"] is False
    assert listed[1]["link"] == "/coach"

    assert client.get("/api/notifications/unread-count", headers=headers).json() == {"unread": 2}

    unread_only = client.get("/api/notifications?unread_only=true", headers=headers).json()
    assert len(unread_only) == 2

    # Mark one as read.
    resp = client.post(f"/api/notifications/{first['id']}/read", headers=headers)
    assert resp.status_code == 200
    assert client.get("/api/notifications/unread-count", headers=headers).json() == {"unread": 1}

    # Unknown id -> 404.
    assert client.post("/api/notifications/999999/read", headers=headers).status_code == 404

    # Mark the rest as read.
    resp = client.post("/api/notifications/read-all", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["updated"] >= 1
    assert client.get("/api/notifications/unread-count", headers=headers).json() == {"unread": 0}


def test_notifications_are_scoped_per_user(client):
    first_email = "notif-a@riacardo.dev"
    first_id = _register(client, first_email)["user_id"]
    first_headers = {"Authorization": f"Bearer {_login_token(client, first_email)}"}

    conn = get_db_connection()
    try:
        create_notification(conn, first_id, "Solo para A")
    finally:
        conn.close()

    second_email = "notif-b@riacardo.dev"
    _register(client, second_email)
    second_headers = {"Authorization": f"Bearer {_login_token(client, second_email)}"}

    assert client.get("/api/notifications", headers=second_headers).json() == []

    # A user cannot mark someone else's notification as read.
    other_id = client.get("/api/notifications", headers=first_headers).json()[0]["id"]
    resp = client.post(f"/api/notifications/{other_id}/read", headers=second_headers)
    assert resp.status_code == 404

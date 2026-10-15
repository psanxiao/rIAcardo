"""Tests for the automatic planning schedule endpoints (/api/settings/plan)."""


def _get_auth_token(client):
    client.post("/api/auth/register", json={
        "email": "planner@riacardo.dev",
        "password": "testpassword",
    })
    resp = client.post("/api/auth/login", json={
        "email": "planner@riacardo.dev",
        "password": "testpassword",
    })
    return resp.json()["access_token"]


def test_plan_schedule_requires_auth(client):
    assert client.get("/api/settings/plan").status_code == 401
    assert client.post("/api/settings/plan", json={}).status_code == 401


def test_plan_schedule_defaults(client):
    token = _get_auth_token(client)
    response = client.get(
        "/api/settings/plan",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is False
    assert data["cadence"] == "weekly"
    assert data["day"] == 0
    assert data["day_name"] == "Lunes"
    assert data["hour"] == 6


def test_plan_schedule_save_and_read_back(client):
    token = _get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/settings/plan",
        json={"enabled": True, "cadence": "biweekly", "day": 4},
        headers=headers,
    )
    assert response.status_code == 200
    saved = response.json()
    assert saved["enabled"] is True
    assert saved["cadence"] == "biweekly"
    assert saved["day"] == 4
    assert saved["day_name"] == "Viernes"
    assert saved["next_run"] is not None

    fetched = client.get("/api/settings/plan", headers=headers).json()
    assert fetched["enabled"] is True
    assert fetched["cadence"] == "biweekly"
    assert fetched["day"] == 4


def test_plan_schedule_rejects_invalid_values(client):
    token = _get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/settings/plan",
        json={"enabled": True, "cadence": "hourly", "day": 0},
        headers=headers,
    )
    assert response.status_code == 400

    response = client.post(
        "/api/settings/plan",
        json={"enabled": True, "cadence": "weekly", "day": 42},
        headers=headers,
    )
    assert response.status_code == 400

"""Tests for performance analysis endpoints."""


def test_training_load_requires_auth(client):
    """GET /api/analysis/training-load without JWT should return 401."""
    response = client.get("/api/analysis/training-load")
    assert response.status_code == 401


def test_mmp_curve_requires_auth(client):
    """GET /api/analysis/mmp-curve without JWT should return 401."""
    response = client.get("/api/analysis/mmp-curve")
    assert response.status_code == 401


def test_efficiency_factor_requires_auth(client):
    """GET /api/analysis/efficiency-factor without JWT should return 401."""
    response = client.get("/api/analysis/efficiency-factor")
    assert response.status_code == 401


def _get_auth_token(client):
    """Helper to register+login and get a JWT token."""
    client.post("/api/auth/register", json={
        "email": "analyst@riacardo.dev",
        "password": "testpassword"
    })
    resp = client.post("/api/auth/login", json={
        "email": "analyst@riacardo.dev",
        "password": "testpassword"
    })
    return resp.json()["access_token"]


def test_training_load_empty(client):
    """Training load for a user with no activities should return empty data."""
    token = _get_auth_token(client)
    response = client.get(
        "/api/analysis/training-load?months=6",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "ctl" in data
    assert "atl" in data
    assert "tsb" in data
    assert "dates" in data


def test_mmp_curve_empty(client):
    """MMP curve for a user with no activities should return empty data."""
    token = _get_auth_token(client)
    response = client.get(
        "/api/analysis/mmp-curve?months=12",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "mmp_curve" in data
    assert "ftp" in data


def test_efficiency_factor_empty(client):
    """EF for a user with no activities should return empty data."""
    token = _get_auth_token(client)
    response = client.get(
        "/api/analysis/efficiency-factor?months=6",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "dates" in data
    assert "values" in data
    assert isinstance(data["dates"], list)
    assert isinstance(data["values"], list)

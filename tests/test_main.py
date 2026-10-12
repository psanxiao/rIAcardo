"""Tests for authentication endpoints (register + login + JWT)."""


def test_read_main(client):
    """Smoke test: API is alive."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_register_new_user(client):
    """Register a brand new user and get back their profile."""
    response = client.post("/api/auth/register", json={
        "email": "test@riacardo.dev",
        "password": "securepassword123"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@riacardo.dev"
    assert "user_id" in data


def test_register_duplicate_user(client):
    """Attempting to register the same email twice should fail with 409."""
    response = client.post("/api/auth/register", json={
        "email": "test@riacardo.dev",
        "password": "anotherpassword"
    })
    assert response.status_code == 409


def test_login_valid_credentials(client):
    """Login with correct credentials should return a JWT token."""
    response = client.post("/api/auth/login", json={
        "email": "test@riacardo.dev",
        "password": "securepassword123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password(client):
    """Login with a wrong password should return 401."""
    response = client.post("/api/auth/login", json={
        "email": "test@riacardo.dev",
        "password": "wrongpassword"
    })
    assert response.status_code == 401


def test_login_nonexistent_user(client):
    """Login with an email that doesn't exist should return 401."""
    response = client.post("/api/auth/login", json={
        "email": "ghost@riacardo.dev",
        "password": "doesntmatter"
    })
    assert response.status_code == 401

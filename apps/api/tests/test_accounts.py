from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from fileflow_api.accounts.service import AccountService
from fileflow_api.app import create_app
from fileflow_api.config import Settings
from fileflow_api.database import Base, build_session_factory


def client(daily_limit: int = 10) -> TestClient:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    settings = Settings(environment="test", free_daily_cloud_jobs=daily_limit)
    accounts = AccountService(build_session_factory(engine), settings)
    return TestClient(create_app(settings, account_service=accounts))


def test_register_authenticate_and_revoke_session() -> None:
    api = client()
    registered = api.post(
        "/api/v1/account/register",
        json={"email": "Person@Example.com", "password": "long-test-password"},
    )
    assert registered.status_code == 201
    payload = registered.json()
    assert payload["account"]["email"] == "person@example.com"
    assert payload["account"]["plan"] == "free"
    headers = {"Authorization": f"Bearer {payload['access_token']}"}
    assert api.get("/api/v1/account/me", headers=headers).status_code == 200
    assert api.delete("/api/v1/account/session", headers=headers).status_code == 204
    assert api.get("/api/v1/account/me", headers=headers).status_code == 401


def test_duplicate_account_and_invalid_login_are_not_accepted() -> None:
    api = client()
    credentials = {"email": "person@example.com", "password": "long-test-password"}
    assert api.post("/api/v1/account/register", json=credentials).status_code == 201
    assert api.post("/api/v1/account/register", json=credentials).status_code == 409
    response = api.post(
        "/api/v1/account/login",
        json={"email": credentials["email"], "password": "incorrect"},
    )
    assert response.status_code == 401


def test_empty_history_and_limits_require_authentication() -> None:
    api = client(daily_limit=3)
    assert api.get("/api/v1/account/history").status_code == 401
    assert (
        api.post(
            "/api/v1/jobs",
            json={"upload_id": "a" * 32, "operation": "image.compress"},
        ).status_code
        == 401
    )
    registered = api.post(
        "/api/v1/account/register",
        json={"email": "person@example.com", "password": "long-test-password"},
    ).json()
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    assert api.get("/api/v1/account/history", headers=headers).json()["items"] == []
    limits = api.get("/api/v1/account/limits", headers=headers).json()
    assert limits["cloud_jobs_used"] == 0
    assert limits["cloud_jobs_limit"] == 3

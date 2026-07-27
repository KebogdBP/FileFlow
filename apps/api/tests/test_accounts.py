from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from fileflow_api.accounts.service import AccountService
from fileflow_api.app import create_app
from fileflow_api.config import Settings
from fileflow_api.database import Base, build_session_factory


class RecordingMailer:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str]] = []

    def send_password_reset(self, email: str, reset_url: str) -> None:
        self.messages.append((email, reset_url))


def client(daily_limit: int = 10, mailer: RecordingMailer | None = None) -> TestClient:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    settings = Settings(environment="test", free_daily_cloud_jobs=daily_limit)
    accounts = AccountService(build_session_factory(engine), settings, mailer)
    return TestClient(create_app(settings, account_service=accounts))


def test_register_authenticate_and_revoke_session() -> None:
    api = client()
    registered = api.post(
        "/api/v1/account/register",
        json={
            "display_name": "  Flow   Tester  ",
            "email": "Person@Example.com",
            "password": "long-test-password",
        },
    )
    assert registered.status_code == 201
    payload = registered.json()
    assert payload["account"]["email"] == "person@example.com"
    assert payload["account"]["display_name"] == "Flow Tester"
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


def test_developer_api_keys_are_shown_once_and_revocable() -> None:
    api = client()
    registered = api.post(
        "/api/v1/account/register",
        json={"email": "developer@example.com", "password": "long-test-password"},
    ).json()
    session_headers = {"Authorization": f"Bearer {registered['access_token']}"}

    created = api.post(
        "/api/v1/account/api-keys", json={"name": "Local MCP"}, headers=session_headers
    )
    assert created.status_code == 201
    key = created.json()["key"]
    assert key.startswith("ff_live_")

    listed = api.get("/api/v1/account/api-keys", headers=session_headers).json()["items"]
    assert len(listed) == 1
    assert listed[0]["id"] == created.json()["id"]
    assert listed[0]["name"] == "Local MCP"
    assert listed[0]["prefix"] == key[:16]
    assert listed[0]["last_used_at"] is None
    assert (
        api.get("/api/v1/account/me", headers={"Authorization": f"Bearer {key}"}).status_code == 200
    )

    assert (
        api.delete(
            f"/api/v1/account/api-keys/{created.json()['id']}", headers=session_headers
        ).status_code
        == 204
    )
    assert (
        api.get("/api/v1/account/me", headers={"Authorization": f"Bearer {key}"}).status_code == 401
    )


def test_password_reset_and_authenticated_password_change() -> None:
    mailer = RecordingMailer()
    api = client(mailer=mailer)
    registered = api.post(
        "/api/v1/account/register",
        json={"email": "person@example.com", "password": "long-test-password"},
    ).json()

    forgot = api.post("/api/v1/account/password/forgot", json={"email": "person@example.com"})
    assert forgot.status_code == 202
    assert mailer.messages[0][0] == "person@example.com"
    reset_token = mailer.messages[0][1].split("reset_token=", 1)[1]
    reset = api.post(
        "/api/v1/account/password/reset",
        json={"token": reset_token, "new_password": "new-long-password"},
    )
    assert reset.status_code == 200
    assert (
        api.post(
            "/api/v1/account/login",
            json={"email": "person@example.com", "password": "long-test-password"},
        ).status_code
        == 401
    )

    changed = api.post(
        "/api/v1/account/password/change",
        headers={"Authorization": f"Bearer {reset.json()['access_token']}"},
        json={
            "current_password": "new-long-password",
            "new_password": "newer-long-password",
        },
    )
    assert changed.status_code == 200
    assert changed.json()["access_token"] != registered["access_token"]


def test_avatar_is_limited_validated_and_returned() -> None:
    api = client()
    registered = api.post(
        "/api/v1/account/register",
        json={"email": "person@example.com", "password": "long-test-password"},
    ).json()
    headers = {
        "Authorization": f"Bearer {registered['access_token']}",
        "Content-Type": "image/jpeg",
    }
    image = b"\xff\xd8\xffavatar"
    assert api.put("/api/v1/account/avatar", headers=headers, content=image).status_code == 204
    profile = api.get("/api/v1/account/me", headers=headers).json()
    assert profile["has_avatar"] is True
    returned = api.get("/api/v1/account/avatar", headers=headers)
    assert returned.content == image
    assert returned.headers["content-type"] == "image/jpeg"

    too_large = b"\xff\xd8\xff" + b"x" * (5 * 1024 * 1024)
    assert api.put("/api/v1/account/avatar", headers=headers, content=too_large).status_code == 413

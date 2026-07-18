from typing import Literal

from fastapi.testclient import TestClient

from fileflow_api.app import create_app
from fileflow_api.config import Settings


def client(environment: Literal["development", "test", "production"] = "test") -> TestClient:
    return TestClient(create_app(Settings(environment=environment)))


def test_liveness_and_readiness_contracts() -> None:
    api = client()
    live = api.get("/api/v1/health/live")
    ready = api.get("/api/v1/health/ready")

    assert live.status_code == 200
    assert live.json() == {"status": "ok", "service": "fileflow-api", "version": "0.1.0"}
    assert ready.json()["status"] == "ready"
    assert ready.headers["x-content-type-options"] == "nosniff"


def test_request_id_is_preserved_when_safe() -> None:
    response = client().get("/", headers={"X-Request-ID": "request_123"})
    assert response.headers["x-request-id"] == "request_123"


def test_unsafe_request_id_is_replaced() -> None:
    response = client().get("/", headers={"X-Request-ID": "not allowed spaces"})
    assert response.headers["x-request-id"] != "not allowed spaces"
    assert len(response.headers["x-request-id"]) == 32


def test_not_found_uses_shared_error_contract() -> None:
    response = client().get("/missing")
    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "http_404",
        "message": "Not Found",
        "request_id": response.headers["x-request-id"],
        "details": None,
    }


def test_docs_are_disabled_in_production() -> None:
    assert client("production").get("/docs").status_code == 404

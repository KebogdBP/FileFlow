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


def test_security_headers_are_applied_to_every_response() -> None:
    response = client().get("/")

    assert (
        response.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    )
    assert response.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"
    assert response.headers["cross-origin-resource-policy"] == "same-site"
    assert response.headers["x-frame-options"] == "DENY"


def test_cross_origin_resource_policy_can_be_relaxed_for_a_separate_frontend() -> None:
    api = TestClient(
        create_app(Settings(environment="test", cross_origin_resource_policy="cross-origin"))
    )

    assert api.get("/").headers["cross-origin-resource-policy"] == "cross-origin"


def test_production_enables_transport_security() -> None:
    response = client("production").get("/")

    assert response.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"


def test_beta_readiness_is_machine_readable_and_fail_closed() -> None:
    response = client("production").get("/api/v1/health/beta")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "blocked"
    assert body["checks"]["production_environment"] is True
    assert body["checks"]["non_default_storage_credentials"] is False
    assert body["checks"]["https_origins_only"] is False
    assert "checked_at" in body

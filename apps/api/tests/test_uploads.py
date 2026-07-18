from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from fileflow_api.app import create_app
from fileflow_api.config import Settings
from fileflow_api.database import Base, build_session_factory
from fileflow_api.uploads.service import UploadService


class FakeStorage:
    def __init__(self) -> None:
        self.completed: list[tuple[int, str]] | None = None
        self.aborted = False

    def create_multipart(self, key: str, content_type: str) -> str:
        assert key.startswith("temporary/")
        assert content_type
        return "multipart-1"

    def presign_part(self, key: str, upload_id: str, part_number: int, ttl: int) -> str:
        return f"https://storage.test/{upload_id}/{part_number}?ttl={ttl}"

    def complete_multipart(self, key: str, upload_id: str, parts: list[tuple[int, str]]) -> None:
        self.completed = parts

    def abort_multipart(self, key: str, upload_id: str) -> None:
        self.aborted = True


@pytest.fixture
def upload_api() -> Generator[tuple[TestClient, FakeStorage]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    settings = Settings(
        environment="test",
        upload_part_size_bytes=5 * 1024 * 1024,
        max_upload_bytes=12 * 1024 * 1024,
    )
    storage = FakeStorage()
    service = UploadService(build_session_factory(engine), storage, settings)
    with TestClient(create_app(settings, service)) as client:
        yield client, storage


def test_complete_secure_multipart_lifecycle(
    upload_api: tuple[TestClient, FakeStorage],
) -> None:
    api, storage = upload_api
    created = api.post(
        "/api/v1/uploads",
        json={
            "filename": "holiday.mov",
            "content_type": "video/quicktime",
            "size_bytes": 6 * 1024 * 1024,
        },
    )
    assert created.status_code == 201
    upload = created.json()
    assert upload["part_count"] == 2
    assert "object_key" not in upload
    assert "multipart_id" not in upload

    signed = api.post(f"/api/v1/uploads/{upload['id']}/parts/2")
    assert signed.status_code == 200
    assert signed.json()["method"] == "PUT"

    completed = api.post(
        f"/api/v1/uploads/{upload['id']}/complete",
        json={
            "parts": [
                {"part_number": 2, "etag": '"part-2"'},
                {"part_number": 1, "etag": '"part-1"'},
            ]
        },
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert storage.completed == [(1, '"part-1"'), (2, '"part-2"')]
    assert api.post(f"/api/v1/uploads/{upload['id']}/parts/1").status_code == 409


def test_upload_limits_types_and_parts_are_validated(
    upload_api: tuple[TestClient, FakeStorage],
) -> None:
    api, _ = upload_api
    unsupported = api.post(
        "/api/v1/uploads",
        json={
            "filename": "payload.exe",
            "content_type": "application/octet-stream",
            "size_bytes": 1,
        },
    )
    oversized = api.post(
        "/api/v1/uploads",
        json={
            "filename": "large.pdf",
            "content_type": "application/pdf",
            "size_bytes": 13 * 1024 * 1024,
        },
    )
    assert unsupported.status_code == 415
    assert oversized.status_code == 413


def test_abort_upload(upload_api: tuple[TestClient, FakeStorage]) -> None:
    api, storage = upload_api
    created = api.post(
        "/api/v1/uploads",
        json={"filename": "voice.wav", "content_type": "audio/wav", "size_bytes": 1024},
    ).json()
    response = api.delete(f"/api/v1/uploads/{created['id']}")
    assert response.status_code == 204
    assert storage.aborted
    assert api.get(f"/api/v1/uploads/{created['id']}").json()["status"] == "aborted"

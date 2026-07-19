from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from fileflow_api.config import Settings
from fileflow_api.database import Base, build_session_factory
from fileflow_api.imports.contracts import ImportCreate
from fileflow_api.imports.downloader import ImportedMedia
from fileflow_api.imports.models import ImportStatus
from fileflow_api.imports.service import SocialImportService
from fileflow_api.imports.url_policy import validate_social_url


class FakeStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def upload_file(self, key: str, source: Path, content_type: str) -> None:
        assert content_type == "video/mp4"
        self.objects[key] = source.read_bytes()

    def delete_object(self, key: str) -> None:
        self.objects.pop(key, None)


class FakeQueue:
    def __init__(self) -> None:
        self.imports: list[str] = []
        self.safety: list[str] = []

    def enqueue_import(self, import_id: str) -> str:
        self.imports.append(import_id)
        return f"import-{import_id}"

    def enqueue_safety(self, upload_id: str) -> str:
        self.safety.append(upload_id)
        return f"safety-{upload_id}"

    def enqueue_job(self, job_id: str) -> str:
        return job_id

    def revoke(self, task_id: str) -> None:
        pass


class FakeClient:
    def download(self, url: str, workspace: Path, max_bytes: int) -> ImportedMedia:
        assert url.startswith("https://www.youtube.com/")
        path = workspace / "source.mp4"
        path.write_bytes(b"\x00\x00\x00\x18ftypisom-public-video")
        return ImportedMedia(path, "My video", "Creator", "https://i.ytimg.com/cover.jpg")


def import_service() -> tuple[SocialImportService, FakeStorage, FakeQueue]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    storage = FakeStorage()
    queue = FakeQueue()
    service = SocialImportService(
        build_session_factory(engine), storage, queue, FakeClient(), Settings(environment="test")
    )
    return service, storage, queue


@pytest.mark.parametrize(
    ("url", "provider"),
    [
        ("https://www.youtube.com/watch?v=abc", "youtube"),
        ("https://youtu.be/abc", "youtube"),
        ("https://www.instagram.com/reel/abc/", "instagram"),
        ("https://www.tiktok.com/@creator/video/123", "tiktok"),
        ("https://www.youtube.com/playlist?list=abc", "youtube"),
        ("https://www.youtube.com/@creator/live", "youtube"),
        ("https://www.instagram.com/creator/", "instagram"),
        ("https://www.tiktok.com/@creator", "tiktok"),
    ],
)
def test_platform_urls_are_classified_without_path_restrictions(url: str, provider: str) -> None:
    assert validate_social_url(url)[0] == provider


@pytest.mark.parametrize(
    "url",
    [
        "http://www.youtube.com/watch?v=abc",
        "https://youtube.com.evil.test/watch?v=abc",
        "https://user:password@youtube.com/watch?v=abc",
        "https://youtube.com:8443/watch?v=abc",
        "https://127.0.0.1/video",
    ],
)
def test_untrusted_or_private_destinations_are_rejected(url: str) -> None:
    with pytest.raises(HTTPException):
        validate_social_url(url)


def test_import_without_rights_attestation_enters_existing_safety_pipeline() -> None:
    service, storage, queue = import_service()
    item = service.create(ImportCreate(url="https://www.youtube.com/watch?v=abc"))
    assert item.status == ImportStatus.QUEUED
    assert queue.imports == [item.id]
    completed = service.execute(item.id)
    assert completed.status == ImportStatus.COMPLETED
    assert completed.upload_id is not None
    assert completed.title == "My video"
    assert completed.creator == "Creator"
    assert queue.safety == [completed.upload_id]
    assert next(iter(storage.objects.values())).startswith(b"\x00\x00\x00\x18ftyp")


def test_import_contract_only_requires_a_platform_url() -> None:
    assert str(ImportCreate(url="https://youtu.be/abc").url) == "https://youtu.be/abc"

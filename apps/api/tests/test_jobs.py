from collections.abc import Iterable, Iterator

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from fileflow_api.config import Settings
from fileflow_api.database import Base, build_session_factory
from fileflow_api.jobs.contracts import JobCreate
from fileflow_api.jobs.models import JobStatus
from fileflow_api.jobs.service import JobService
from fileflow_api.safety.scanner import MalwareVerdict, ScanResult
from fileflow_api.safety.service import SafetyService
from fileflow_api.uploads.contracts import CompletedPart, UploadCreate
from fileflow_api.uploads.service import UploadService


class MemoryStorage:
    content = b"\x89PNG\r\n\x1a\ncontent"

    def create_multipart(self, key: str, content_type: str) -> str:
        return "multipart"

    def presign_part(self, key: str, upload_id: str, part_number: int, ttl: int) -> str:
        return "https://storage.test/part"

    def complete_multipart(self, key: str, upload_id: str, parts: list[tuple[int, str]]) -> None:
        pass

    def abort_multipart(self, key: str, upload_id: str) -> None:
        pass

    def object_size(self, key: str) -> int:
        return len(self.content)

    def iter_object(self, key: str, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        yield self.content

    def delete_object(self, key: str) -> None:
        pass


class CleanScanner:
    def scan(self, chunks: Iterable[bytes]) -> ScanResult:
        b"".join(chunks)
        return ScanResult(MalwareVerdict.CLEAN)


class FakeQueue:
    def __init__(self, fail_safety: bool = False) -> None:
        self.fail_safety = fail_safety
        self.jobs: list[str] = []
        self.safety: list[str] = []
        self.revoked: list[str] = []

    def enqueue_safety(self, upload_id: str) -> str:
        if self.fail_safety:
            raise ConnectionError("redis unavailable")
        self.safety.append(upload_id)
        return f"safety-{upload_id}"

    def enqueue_job(self, job_id: str) -> str:
        self.jobs.append(job_id)
        return f"task-{job_id}"

    def revoke(self, task_id: str) -> None:
        self.revoked.append(task_id)


def services() -> tuple[JobService, SafetyService, UploadService, FakeQueue]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = build_session_factory(engine)
    settings = Settings(environment="test", safety_header_bytes=512)
    storage = MemoryStorage()
    queue = FakeQueue()
    safety = SafetyService(sessions, storage, CleanScanner(), settings)
    uploads = UploadService(sessions, storage, settings, queue)
    return JobService(sessions, safety, queue, settings), safety, uploads, queue


def completed_upload(uploads: UploadService) -> str:
    upload = uploads.create(
        UploadCreate(
            filename="image.png",
            content_type="image/png",
            size_bytes=len(MemoryStorage.content),
        )
    )
    uploads.complete(upload.id, [CompletedPart(part_number=1, etag='"etag"')])
    return upload.id


def test_job_requires_clean_upload_and_tracks_lifecycle() -> None:
    jobs, safety, uploads, queue = services()
    upload_id = completed_upload(uploads)
    with pytest.raises(HTTPException, match="not passed"):
        jobs.create(JobCreate(upload_id=upload_id, operation="image.compress"))
    safety.inspect(upload_id)
    job = jobs.create(JobCreate(upload_id=upload_id, operation="image.compress"))
    assert job.status == JobStatus.QUEUED
    assert queue.jobs == [job.id]
    assert jobs.start(job.id).attempts == 1
    assert jobs.progress(job.id, 40).progress == 40
    finished = jobs.succeed(job.id)
    assert finished.status == JobStatus.SUCCEEDED
    assert finished.progress == 100


def test_only_one_active_job_and_cancellation_is_non_destructive() -> None:
    jobs, safety, uploads, queue = services()
    upload_id = completed_upload(uploads)
    safety.inspect(upload_id)
    first = jobs.create(JobCreate(upload_id=upload_id, operation="image.resize"))
    with pytest.raises(HTTPException, match="active processing job"):
        jobs.create(JobCreate(upload_id=upload_id, operation="image.compress"))
    cancelled = jobs.cancel(first.id)
    assert cancelled.status == JobStatus.CANCELLED
    assert queue.revoked == [f"task-{first.id}"]
    replacement = jobs.create(JobCreate(upload_id=upload_id, operation="image.compress"))
    assert replacement.status == JobStatus.QUEUED


def test_completed_upload_stays_fail_closed_when_queue_is_unavailable() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    settings = Settings(environment="test")
    queue = FakeQueue(fail_safety=True)
    uploads = UploadService(build_session_factory(engine), MemoryStorage(), settings, queue)
    upload_id = completed_upload(uploads)
    upload = uploads.get(upload_id)
    assert upload.safety_status.value == "error"
    assert upload.rejection_reason == "queue_unavailable"


def test_multi_source_job_requires_every_upload_to_be_clean() -> None:
    jobs, safety, uploads, _ = services()
    primary = completed_upload(uploads)
    additional = completed_upload(uploads)
    safety.inspect(primary)
    with pytest.raises(HTTPException, match="not passed"):
        jobs.create(
            JobCreate(
                upload_id=primary,
                source_upload_ids=[additional],
                operation="merge-pdf",
            )
        )
    safety.inspect(additional)
    job = jobs.create(
        JobCreate(
            upload_id=primary,
            source_upload_ids=[additional],
            operation="merge-pdf",
        )
    )
    assert job.source_upload_ids == [additional]

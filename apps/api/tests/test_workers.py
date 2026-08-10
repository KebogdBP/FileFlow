from collections.abc import Iterable, Iterator
from pathlib import Path

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
from fileflow_api.workers.contracts import (
    InvalidJobParameters,
    OperationRegistry,
    WorkRequest,
    WorkResult,
)
from fileflow_api.workers.executor import CloudJobExecutor
from fileflow_api.workers.subprocess import ProcessLimits, SafeSubprocessRunner


class MemoryStorage:
    source = b"\x89PNG\r\n\x1a\ncloud-worker-source"

    def __init__(self) -> None:
        self.results: dict[str, bytes] = {}

    def create_multipart(self, key: str, content_type: str) -> str:
        return "multipart"

    def presign_part(self, key: str, upload_id: str, part_number: int, ttl: int) -> str:
        return "https://storage.test/part"

    def complete_multipart(self, key: str, upload_id: str, parts: list[tuple[int, str]]) -> None:
        pass

    def abort_multipart(self, key: str, upload_id: str) -> None:
        pass

    def object_size(self, key: str) -> int:
        return len(self.source)

    def iter_object(self, key: str, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        yield self.source

    def delete_object(self, key: str) -> None:
        pass

    def upload_file(self, key: str, source: Path, content_type: str) -> None:
        self.results[key] = source.read_bytes()


class CleanScanner:
    def scan(self, chunks: Iterable[bytes]) -> ScanResult:
        b"".join(chunks)
        return ScanResult(MalwareVerdict.CLEAN)


class FakeQueue:
    def enqueue_safety(self, upload_id: str) -> str:
        return f"safety-{upload_id}"

    def enqueue_job(self, job_id: str) -> str:
        return f"job-{job_id}"

    def revoke(self, task_id: str) -> None:
        pass


class CopyHandler:
    def accepts(self, content_type: str) -> bool:
        return content_type == "image/png"

    def execute(self, request: WorkRequest) -> WorkResult:
        request.report_progress(50)
        request.output_path.write_bytes(request.input_path.read_bytes() + b"-result")
        return WorkResult(content_type="image/png")


class InvalidParameterHandler:
    def accepts(self, content_type: str) -> bool:
        return content_type == "image/png"

    def execute(self, request: WorkRequest) -> WorkResult:
        raise InvalidJobParameters()


def executor_services() -> tuple[
    CloudJobExecutor, JobService, OperationRegistry, MemoryStorage, str
]:
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
    upload = uploads.create(
        UploadCreate(
            filename="source.png", content_type="image/png", size_bytes=len(storage.source)
        )
    )
    uploads.complete(upload.id, [CompletedPart(part_number=1, etag='"etag"')])
    safety.inspect(upload.id)
    jobs = JobService(sessions, safety, queue, settings)
    registry = OperationRegistry()
    return (
        CloudJobExecutor(jobs, safety, storage, registry, settings),
        jobs,
        registry,
        storage,
        upload.id,
    )


def test_cloud_executor_materializes_runs_and_persists_result() -> None:
    executor, jobs, registry, storage, upload_id = executor_services()
    registry.register("test.copy", CopyHandler())
    job = jobs.create(
        JobCreate(upload_id=upload_id, operation="test.copy", parameters={"quality": 80})
    )
    assert executor.execute(job.id) == JobStatus.SUCCEEDED
    completed = jobs.get(job.id)
    assert completed.progress == 100
    assert completed.result_content_type == "image/png"
    assert completed.result_size_bytes == len(storage.source + b"-result")
    assert next(iter(storage.results.values())) == storage.source + b"-result"


def test_unknown_operation_fails_without_touching_storage() -> None:
    executor, jobs, _, storage, upload_id = executor_services()
    job = jobs.create(JobCreate(upload_id=upload_id, operation="unknown.operation"))
    assert executor.execute(job.id) == JobStatus.FAILED
    assert jobs.get(job.id).error_code == "unsupported_operation"
    assert storage.results == {}


def test_invalid_parameters_return_a_stable_failure_without_crashing_worker() -> None:
    executor, jobs, registry, storage, upload_id = executor_services()
    registry.register("test.invalid", InvalidParameterHandler())
    job = jobs.create(JobCreate(upload_id=upload_id, operation="test.invalid"))
    assert executor.execute(job.id) == JobStatus.FAILED
    assert jobs.get(job.id).error_code == "invalid_job_parameters"
    assert storage.results == {}


def test_safe_subprocess_rejects_path_lookup(tmp_path: Path) -> None:
    runner = SafeSubprocessRunner(
        ProcessLimits(
            timeout_seconds=1,
            cpu_seconds=1,
            memory_bytes=128 * 1024 * 1024,
            output_bytes=1024,
            open_files=8,
        )
    )
    try:
        runner.run(["echo", "unsafe"], tmp_path)
    except ValueError as error:
        assert "absolute path" in str(error)
    else:
        raise AssertionError("relative executable was accepted")

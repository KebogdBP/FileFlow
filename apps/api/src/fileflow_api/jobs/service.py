from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from fileflow_api.config import Settings
from fileflow_api.jobs.contracts import JobCreate
from fileflow_api.jobs.models import Job, JobStatus
from fileflow_api.jobs.queue import TaskQueue
from fileflow_api.safety.service import SafetyService

ACTIVE_STATUSES = (JobStatus.QUEUED, JobStatus.RUNNING)


class JobService:
    def __init__(
        self,
        sessions: sessionmaker[Session],
        safety: SafetyService,
        queue: TaskQueue,
        settings: Settings,
    ) -> None:
        self._sessions = sessions
        self._safety = safety
        self._queue = queue
        self._settings = settings

    def create(self, request: JobCreate, account_id: str | None = None) -> Job:
        self._safety.require_clean(request.upload_id)
        if request.upload_id in request.source_upload_ids:
            raise HTTPException(status_code=422, detail="Source uploads must be unique.")
        for upload_id in request.source_upload_ids:
            self._safety.require_clean(upload_id)
        with self._sessions.begin() as session:
            active = session.scalar(
                select(func.count())
                .select_from(Job)
                .where(Job.upload_id == request.upload_id, Job.status.in_(ACTIVE_STATUSES))
            )
            if active is not None and active >= self._settings.max_active_jobs_per_upload:
                raise HTTPException(
                    status_code=409, detail="Upload already has an active processing job."
                )
            job = Job(
                id=uuid4().hex,
                account_id=account_id,
                upload_id=request.upload_id,
                source_upload_ids=request.source_upload_ids,
                operation=request.operation,
                parameters=request.parameters,
                status=JobStatus.QUEUED,
                progress=0,
                attempts=0,
                task_id=None,
                error_code=None,
                created_at=datetime.now(UTC),
                started_at=None,
                finished_at=None,
                result_object_key=None,
                result_content_type=None,
                result_size_bytes=None,
                runtime_ms=None,
                peak_memory_bytes=None,
            )
            session.add(job)
        try:
            task_id = self._queue.enqueue_job(job.id)
        except Exception:
            self.fail(job.id, "queue_unavailable")
            raise HTTPException(status_code=503, detail="Job queue is unavailable.") from None
        with self._sessions.begin() as session:
            stored = session.get(Job, job.id)
            assert stored is not None
            stored.task_id = task_id
        return self.get(job.id)

    def get(self, job_id: str) -> Job:
        with self._sessions() as session:
            job = session.get(Job, job_id)
            if job is None:
                raise HTTPException(status_code=404, detail="Job was not found.")
            session.expunge(job)
            return job

    def start(self, job_id: str) -> Job:
        with self._sessions.begin() as session:
            job = session.get(Job, job_id)
            if job is None or job.status != JobStatus.QUEUED:
                raise HTTPException(status_code=409, detail="Job cannot be started.")
            self._safety.require_clean(job.upload_id)
            for upload_id in job.source_upload_ids:
                self._safety.require_clean(upload_id)
            job.status = JobStatus.RUNNING
            job.attempts += 1
            job.started_at = datetime.now(UTC)
        return self.get(job_id)

    def progress(self, job_id: str, value: int) -> Job:
        if value < 0 or value > 99:
            raise ValueError("running progress must be between 0 and 99")
        with self._sessions.begin() as session:
            job = session.get(Job, job_id)
            if job is None or job.status != JobStatus.RUNNING:
                raise HTTPException(status_code=409, detail="Job is not running.")
            job.progress = value
        return self.get(job_id)

    def succeed(self, job_id: str) -> Job:
        return self._finish(job_id, JobStatus.SUCCEEDED, None)

    def attach_result(
        self, job_id: str, object_key: str, content_type: str, size_bytes: int
    ) -> Job:
        with self._sessions.begin() as session:
            job = session.get(Job, job_id)
            if job is None or job.status != JobStatus.RUNNING:
                raise HTTPException(status_code=409, detail="Job is not running.")
            job.result_object_key = object_key
            job.result_content_type = content_type
            job.result_size_bytes = size_bytes
        return self.get(job_id)

    def record_metrics(self, job_id: str, runtime_ms: int, peak_memory_bytes: int) -> Job:
        with self._sessions.begin() as session:
            job = session.get(Job, job_id)
            if job is None:
                raise HTTPException(status_code=404, detail="Job was not found.")
            job.runtime_ms = max(0, runtime_ms)
            job.peak_memory_bytes = max(0, peak_memory_bytes)
        return self.get(job_id)

    def fail(self, job_id: str, error_code: str) -> Job:
        return self._finish(job_id, JobStatus.FAILED, error_code[:64])

    def cancel(self, job_id: str) -> Job:
        job = self.get(job_id)
        if job.status not in ACTIVE_STATUSES:
            raise HTTPException(status_code=409, detail="Job cannot be cancelled.")
        if job.task_id:
            self._queue.revoke(job.task_id)
        return self._finish(job_id, JobStatus.CANCELLED, None)

    def _finish(self, job_id: str, status: JobStatus, error_code: str | None) -> Job:
        with self._sessions.begin() as session:
            job = session.get(Job, job_id)
            if job is None:
                raise HTTPException(status_code=404, detail="Job was not found.")
            job.status = status
            job.progress = 100 if status == JobStatus.SUCCEEDED else job.progress
            job.error_code = error_code
            job.finished_at = datetime.now(UTC)
        return self.get(job_id)

from typing import Protocol

from celery import Celery

from fileflow_api.config import Settings


class TaskQueue(Protocol):
    def enqueue_safety(self, upload_id: str) -> str: ...

    def enqueue_job(self, job_id: str) -> str: ...

    def enqueue_import(self, import_id: str) -> str: ...

    def revoke(self, task_id: str) -> None: ...


class NullTaskQueue:
    def enqueue_safety(self, upload_id: str) -> str:
        return f"local-safety-{upload_id}"

    def enqueue_job(self, job_id: str) -> str:
        return f"local-job-{job_id}"

    def enqueue_import(self, import_id: str) -> str:
        return f"local-import-{import_id}"

    def revoke(self, task_id: str) -> None:
        pass


def create_celery(settings: Settings) -> Celery:
    app = Celery("fileflow", broker=settings.redis_url, backend=settings.redis_url)
    app.conf.update(
        accept_content=["json"],
        task_serializer="json",
        result_serializer="json",
        task_acks_late=True,
        task_reject_on_worker_lost=True,
        worker_prefetch_multiplier=1,
        task_track_started=True,
        task_soft_time_limit=settings.job_soft_time_limit_seconds,
        task_time_limit=settings.job_time_limit_seconds,
        result_expires=3600,
        task_routes={
            "fileflow.safety.inspect": {"queue": "safety"},
            "fileflow.jobs.execute": {"queue": "processing"},
            "fileflow.imports.execute": {"queue": "imports"},
        },
    )
    return app


class CeleryTaskQueue:
    def __init__(self, app: Celery) -> None:
        self._app = app

    def enqueue_safety(self, upload_id: str) -> str:
        task = self._app.send_task("fileflow.safety.inspect", args=[upload_id])
        return str(task.id)

    def enqueue_job(self, job_id: str) -> str:
        task = self._app.send_task("fileflow.jobs.execute", args=[job_id], task_id=job_id)
        return str(task.id)

    def enqueue_import(self, import_id: str) -> str:
        task = self._app.send_task("fileflow.imports.execute", args=[import_id])
        return str(task.id)

    def revoke(self, task_id: str) -> None:
        self._app.control.revoke(task_id, terminate=False)

from fileflow_api.config import get_settings
from fileflow_api.database import build_engine, build_session_factory
from fileflow_api.jobs.queue import CeleryTaskQueue, create_celery
from fileflow_api.jobs.service import JobService
from fileflow_api.safety.scanner import ClamAVScanner
from fileflow_api.safety.service import SafetyService
from fileflow_api.uploads.storage import S3ObjectStorage
from fileflow_api.workers.contracts import OperationRegistry
from fileflow_api.workers.executor import CloudJobExecutor

settings = get_settings()
celery_app = create_celery(settings)
sessions = build_session_factory(build_engine(settings.database_url))
storage = S3ObjectStorage(
    endpoint_url=settings.s3_endpoint_url,
    access_key=settings.s3_access_key,
    secret_key=settings.s3_secret_key,
    bucket=settings.s3_bucket,
    region=settings.s3_region,
)
safety = SafetyService(
    sessions,
    storage,
    ClamAVScanner(
        settings.malware_scanner_host,
        settings.malware_scanner_port,
        settings.malware_scanner_timeout_seconds,
    ),
    settings,
)
queue = CeleryTaskQueue(celery_app)
jobs = JobService(sessions, safety, queue, settings)
operations = OperationRegistry()
executor = CloudJobExecutor(jobs, safety, storage, operations, settings)


@celery_app.task(  # type: ignore[untyped-decorator]
    name="fileflow.safety.inspect",
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
)
def inspect_upload(upload_id: str) -> str:
    return safety.inspect(upload_id).safety_status.value


@celery_app.task(name="fileflow.jobs.execute")  # type: ignore[untyped-decorator]
def execute_job(job_id: str) -> str:
    return executor.execute(job_id).value

from fileflow_api.config import get_settings
from fileflow_api.database import build_engine, build_session_factory
from fileflow_api.documents.registry import register_document_operations
from fileflow_api.imports.downloader import YtDlpClient
from fileflow_api.imports.service import SocialImportService
from fileflow_api.jobs.queue import CeleryTaskQueue, create_celery
from fileflow_api.jobs.service import JobService
from fileflow_api.media.registry import register_media_operations
from fileflow_api.safety.scanner import ClamAVScanner
from fileflow_api.safety.service import SafetyService
from fileflow_api.uploads.storage import S3ObjectStorage
from fileflow_api.workers.contracts import OperationRegistry
from fileflow_api.workers.executor import CloudJobExecutor
from fileflow_api.workers.subprocess import ProcessLimits, SafeSubprocessRunner

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
runner = SafeSubprocessRunner(
    ProcessLimits(
        timeout_seconds=settings.job_time_limit_seconds,
        cpu_seconds=settings.worker_cpu_limit_seconds,
        memory_bytes=settings.worker_memory_limit_bytes,
        output_bytes=settings.worker_max_output_bytes,
        open_files=settings.worker_file_limit,
    )
)
register_media_operations(operations, settings.ffmpeg_path, runner)
register_document_operations(
    operations,
    {
        "libreoffice": settings.libreoffice_path,
        "qpdf": settings.qpdf_path,
        "ghostscript": settings.ghostscript_path,
        "pdftoppm": settings.pdftoppm_path,
    },
    runner,
)
executor = CloudJobExecutor(jobs, safety, storage, operations, settings)
imports = SocialImportService(
    sessions,
    storage,
    queue,
    YtDlpClient(
        settings.social_import_cookies_file,
        settings.social_import_pot_provider_url,
        settings.social_import_proxy_url,
    ),
    settings,
)


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


@celery_app.task(name="fileflow.imports.execute")  # type: ignore[untyped-decorator]
def execute_import(import_id: str) -> str:
    return imports.execute(import_id).status.value

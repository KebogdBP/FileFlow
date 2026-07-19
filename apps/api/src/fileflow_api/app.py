import re
from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from fileflow_api.config import Settings, get_settings
from fileflow_api.contracts import MessageResponse
from fileflow_api.database import build_engine, build_session_factory
from fileflow_api.errors import http_error_handler, validation_error_handler
from fileflow_api.health import router as health_router
from fileflow_api.imports.downloader import YtDlpClient
from fileflow_api.imports.router import router as imports_router
from fileflow_api.imports.service import SocialImportService
from fileflow_api.jobs.queue import CeleryTaskQueue, TaskQueue, create_celery
from fileflow_api.jobs.router import router as jobs_router
from fileflow_api.jobs.service import JobService
from fileflow_api.safety.scanner import ClamAVScanner
from fileflow_api.safety.service import SafetyService
from fileflow_api.uploads.router import router as uploads_router
from fileflow_api.uploads.service import UploadService
from fileflow_api.uploads.storage import S3ObjectStorage

REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def create_app(
    settings: Settings | None = None,
    upload_service: UploadService | None = None,
    safety_service: SafetyService | None = None,
    task_queue: TaskQueue | None = None,
    job_service: JobService | None = None,
    import_service: SocialImportService | None = None,
) -> FastAPI:
    current = settings or get_settings()
    app = FastAPI(
        title=current.app_name,
        version="0.1.0",
        docs_url="/docs" if current.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if current.docs_enabled else None,
    )
    app.state.settings = current
    sessions = build_session_factory(build_engine(current.database_url))
    storage = S3ObjectStorage(
        endpoint_url=current.s3_endpoint_url,
        access_key=current.s3_access_key,
        secret_key=current.s3_secret_key,
        bucket=current.s3_bucket,
        region=current.s3_region,
    )
    queue = task_queue or CeleryTaskQueue(create_celery(current))
    current_safety = safety_service or SafetyService(
        sessions,
        storage,
        ClamAVScanner(
            host=current.malware_scanner_host,
            port=current.malware_scanner_port,
            timeout=current.malware_scanner_timeout_seconds,
        ),
        current,
    )
    app.state.upload_service = upload_service or UploadService(sessions, storage, current, queue)
    app.state.safety_service = current_safety
    app.state.job_service = job_service or JobService(sessions, current_safety, queue, current)
    app.state.import_service = import_service or SocialImportService(
        sessions, storage, queue, YtDlpClient(), current
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in current.allowed_origins],
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID"],
    )

    @app.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        supplied = request.headers.get("X-Request-ID", "")
        request.state.request_id = (
            supplied if REQUEST_ID_PATTERN.fullmatch(supplied) else uuid4().hex
        )
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    app.add_exception_handler(StarletteHTTPException, http_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.include_router(health_router, prefix=current.api_prefix)
    app.include_router(uploads_router, prefix=current.api_prefix)
    app.include_router(jobs_router, prefix=current.api_prefix)
    app.include_router(imports_router, prefix=current.api_prefix)

    @app.get("/", response_model=MessageResponse, include_in_schema=False)
    def root() -> MessageResponse:
        return MessageResponse(message="FileFlow API")

    return app

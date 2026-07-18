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
from fileflow_api.errors import http_error_handler, validation_error_handler
from fileflow_api.health import router as health_router

REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def create_app(settings: Settings | None = None) -> FastAPI:
    current = settings or get_settings()
    app = FastAPI(
        title=current.app_name,
        version="0.1.0",
        docs_url="/docs" if current.docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if current.docs_enabled else None,
    )
    app.state.settings = current
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in current.allowed_origins],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
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

    @app.get("/", response_model=MessageResponse, include_in_schema=False)
    def root() -> MessageResponse:
        return MessageResponse(message="FileFlow API")

    return app

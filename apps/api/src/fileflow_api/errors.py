from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from fileflow_api.contracts import ErrorBody, ErrorResponse


def _request_id(request: Request) -> str:
    return str(request.state.request_id)


async def http_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, HTTPException)
    message = exc.detail if isinstance(exc.detail, str) else "The request could not be completed."
    payload = ErrorResponse(
        error=ErrorBody(
            code=f"http_{exc.status_code}", message=message, request_id=_request_id(request)
        )
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump(mode="json"))


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    details: list[dict[str, Any]] = [
        {"location": list(error["loc"]), "message": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]
    payload = ErrorResponse(
        error=ErrorBody(
            code="validation_error",
            message="The request contains invalid data.",
            request_id=_request_id(request),
            details=details,
        )
    )
    return JSONResponse(status_code=422, content=payload.model_dump(mode="json"))

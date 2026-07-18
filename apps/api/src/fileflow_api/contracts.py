from typing import Any, Literal

from pydantic import BaseModel, Field


class ServiceStatus(BaseModel):
    status: Literal["ok", "ready"]
    service: str = "fileflow-api"
    version: str = "0.1.0"


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str
    details: list[dict[str, Any]] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


class MessageResponse(BaseModel):
    message: str = Field(min_length=1)

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from fileflow_api.jobs.models import JobStatus

OPERATION_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$")


class JobCreate(BaseModel):
    upload_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    source_upload_ids: list[str] = Field(default_factory=list, max_length=19)
    operation: str = Field(min_length=2, max_length=64)
    parameters: dict[str, str | int | float | bool | None] = Field(default_factory=dict)

    @field_validator("operation")
    @classmethod
    def valid_operation(cls, value: str) -> str:
        if not OPERATION_PATTERN.fullmatch(value):
            raise ValueError("operation must be a stable lowercase identifier")
        return value

    @field_validator("source_upload_ids")
    @classmethod
    def valid_sources(cls, values: list[str]) -> list[str]:
        if any(not re.fullmatch(r"^[a-f0-9]{32}$", value) for value in values):
            raise ValueError("source upload ids must be stable identifiers")
        if len(values) != len(set(values)):
            raise ValueError("source upload ids must be unique")
        return values


class JobResponse(BaseModel):
    id: str
    upload_id: str
    source_upload_ids: list[str]
    operation: str
    parameters: dict[str, str | int | float | bool | None]
    status: JobStatus
    progress: int
    attempts: int
    error_code: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    result_content_type: str | None
    result_size_bytes: int | None
    runtime_ms: int | None
    peak_memory_bytes: int | None

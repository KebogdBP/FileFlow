import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from fileflow_api.jobs.models import JobStatus

OPERATION_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$")


class JobCreate(BaseModel):
    upload_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    operation: str = Field(min_length=2, max_length=64)
    parameters: dict[str, str | int | float | bool | None] = Field(default_factory=dict)

    @field_validator("operation")
    @classmethod
    def valid_operation(cls, value: str) -> str:
        if not OPERATION_PATTERN.fullmatch(value):
            raise ValueError("operation must be a stable lowercase identifier")
        return value


class JobResponse(BaseModel):
    id: str
    upload_id: str
    operation: str
    parameters: dict[str, str | int | float | bool | None]
    status: JobStatus
    progress: int
    attempts: int
    error_code: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None

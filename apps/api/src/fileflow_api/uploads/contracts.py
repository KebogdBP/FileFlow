from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from fileflow_api.uploads.models import UploadStatus


class UploadCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=127)
    size_bytes: int = Field(gt=0)

    @field_validator("filename")
    @classmethod
    def safe_filename(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned or any(ord(character) < 32 for character in cleaned):
            raise ValueError("filename contains unsupported characters")
        return cleaned


class UploadResponse(BaseModel):
    id: str
    filename: str
    content_type: str
    size_bytes: int
    status: UploadStatus
    part_size_bytes: int
    part_count: int
    expires_at: datetime


class PartUrlResponse(BaseModel):
    part_number: int
    method: Literal["PUT"] = "PUT"
    url: str
    expires_in_seconds: int


class CompletedPart(BaseModel):
    part_number: int = Field(ge=1, le=10_000)
    etag: str = Field(min_length=1, max_length=255)


class UploadComplete(BaseModel):
    parts: list[CompletedPart] = Field(min_length=1, max_length=10_000)

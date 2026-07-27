from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

from fileflow_api.imports.models import ImportStatus


class ImportCreate(BaseModel):
    url: HttpUrl
    media_type: Literal["video", "audio"] = "video"
    video_quality: Literal["best", "1080", "720", "480"] = "best"
    audio_bitrate_kbps: Literal[128, 192, 320] = 192
    start_seconds: float | None = Field(default=None, ge=0, le=86_400)
    end_seconds: float | None = Field(default=None, gt=0, le=86_400)
    playlist_item: int | None = Field(default=None, ge=1, le=500)

    @model_validator(mode="after")
    def validate_time_range(self) -> "ImportCreate":
        if (
            self.start_seconds is not None
            and self.end_seconds is not None
            and self.end_seconds <= self.start_seconds
        ):
            raise ValueError("end_seconds must be greater than start_seconds")
        return self


class ImportResponse(BaseModel):
    id: str
    provider: str
    status: ImportStatus
    upload_id: str | None
    title: str | None
    creator: str | None
    thumbnail_url: str | None
    media_type: Literal["video", "audio"]
    video_quality: Literal["best", "1080", "720", "480"]
    audio_bitrate_kbps: int
    start_seconds: float | None
    end_seconds: float | None
    playlist_item: int | None
    error_code: str | None
    created_at: datetime
    finished_at: datetime | None

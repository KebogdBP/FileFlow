from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

from fileflow_api.imports.models import ImportStatus


class ImportCreate(BaseModel):
    url: HttpUrl
    media_type: Literal["video", "audio", "subtitles", "comments"] = "video"
    video_quality: Literal["best", "1080", "720", "480"] = "best"
    audio_bitrate_kbps: Literal[128, 192, 320] = 192
    start_seconds: float | None = Field(default=None, ge=0, le=86_400)
    end_seconds: float | None = Field(default=None, gt=0, le=86_400)
    playlist_item: int | None = Field(default=None, ge=1, le=500)
    playlist_count: int | None = Field(default=None, ge=0, le=500)
    generic_audio: bool = False
    subtitle_language: str = Field(default="en", pattern=r"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$")

    @model_validator(mode="after")
    def validate_time_range(self) -> "ImportCreate":
        if self.playlist_item is not None and self.playlist_count is not None:
            raise ValueError("playlist_item and playlist_count cannot be combined")
        if self.generic_audio and self.media_type != "audio":
            raise ValueError("generic_audio requires audio media_type")
        if self.media_type in {"subtitles", "comments"} and (
            self.playlist_item is not None or self.playlist_count is not None
        ):
            raise ValueError("text extraction supports one video at a time")
        if (
            self.start_seconds is not None
            and self.end_seconds is not None
            and self.end_seconds <= self.start_seconds
        ):
            raise ValueError("end_seconds must be greater than start_seconds")
        return self


class DirectDownloadTicket(BaseModel):
    download_path: str
    expires_at: datetime


class ImportResponse(BaseModel):
    id: str
    provider: str
    status: ImportStatus
    progress: int = Field(ge=0, le=100)
    upload_id: str | None
    title: str | None
    creator: str | None
    thumbnail_url: str | None
    media_type: Literal["video", "audio", "subtitles", "comments"]
    video_quality: Literal["best", "1080", "720", "480"]
    audio_bitrate_kbps: int
    start_seconds: float | None
    end_seconds: float | None
    playlist_item: int | None
    playlist_count: int | None
    generic_audio: bool
    subtitle_language: str
    error_code: str | None
    created_at: datetime
    finished_at: datetime | None

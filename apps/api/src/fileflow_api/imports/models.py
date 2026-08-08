from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from fileflow_api.database import Base


class ImportStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class SocialImport(Base):
    __tablename__ = "social_imports"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    source_url: Mapped[str] = mapped_column(String(2048))
    provider: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[ImportStatus] = mapped_column(Enum(ImportStatus), index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    upload_id: Mapped[str | None] = mapped_column(
        ForeignKey("uploads.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    creator: Mapped[str | None] = mapped_column(String(255), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    media_type: Mapped[str] = mapped_column(String(16), default="video")
    video_quality: Mapped[str] = mapped_column(String(16), default="best")
    audio_bitrate_kbps: Mapped[int] = mapped_column(Integer, default=192)
    start_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    end_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    playlist_item: Mapped[int | None] = mapped_column(Integer, nullable=True)
    playlist_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    generic_audio: Mapped[bool] = mapped_column(Boolean, default=False)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

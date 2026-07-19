from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, String
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
    task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    upload_id: Mapped[str | None] = mapped_column(
        ForeignKey("uploads.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    creator: Mapped[str | None] = mapped_column(String(255), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

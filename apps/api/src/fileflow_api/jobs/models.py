from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, BigInteger, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from fileflow_api.database import Base


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    upload_id: Mapped[str] = mapped_column(ForeignKey("uploads.id", ondelete="CASCADE"), index=True)
    operation: Mapped[str] = mapped_column(String(64), index=True)
    parameters: Mapped[dict[str, str | int | float | bool | None]] = mapped_column(JSON)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    task_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_object_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    result_content_type: Mapped[str | None] = mapped_column(String(127), nullable=True)
    result_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    runtime_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    peak_memory_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

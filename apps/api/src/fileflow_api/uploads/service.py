from datetime import UTC, datetime, timedelta
from math import ceil
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from fileflow_api.config import Settings
from fileflow_api.uploads.contracts import CompletedPart, UploadCreate
from fileflow_api.uploads.models import SafetyStatus, Upload, UploadPart, UploadStatus
from fileflow_api.uploads.storage import ObjectStorage

ALLOWED_CONTENT_PREFIXES = ("image/", "video/", "audio/")
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class UploadService:
    def __init__(
        self,
        sessions: sessionmaker[Session],
        storage: ObjectStorage,
        settings: Settings,
    ) -> None:
        self._sessions = sessions
        self._storage = storage
        self._settings = settings

    def create(self, request: UploadCreate) -> Upload:
        if request.size_bytes > self._settings.max_upload_bytes:
            raise HTTPException(status_code=413, detail="Upload exceeds the size limit.")
        if not (
            request.content_type.startswith(ALLOWED_CONTENT_PREFIXES)
            or request.content_type in ALLOWED_DOCUMENT_TYPES
        ):
            raise HTTPException(status_code=415, detail="File type is not supported.")
        part_count = ceil(request.size_bytes / self._settings.upload_part_size_bytes)
        if part_count > 10_000:
            raise HTTPException(status_code=413, detail="Upload requires too many parts.")
        now = datetime.now(UTC)
        upload_id = uuid4().hex
        key = f"temporary/{now:%Y/%m/%d}/{upload_id}/source"
        multipart_id = self._storage.create_multipart(key, request.content_type)
        upload = Upload(
            id=upload_id,
            object_key=key,
            multipart_id=multipart_id,
            filename=request.filename,
            content_type=request.content_type,
            size_bytes=request.size_bytes,
            part_size_bytes=self._settings.upload_part_size_bytes,
            part_count=part_count,
            status=UploadStatus.UPLOADING,
            created_at=now,
            expires_at=now + timedelta(seconds=self._settings.upload_retention_seconds),
            completed_at=None,
            safety_status=SafetyStatus.PENDING,
            detected_content_type=None,
            rejection_reason=None,
            scanned_at=None,
        )
        with self._sessions.begin() as session:
            session.add(upload)
        return upload

    def get(self, upload_id: str) -> Upload:
        with self._sessions() as session:
            upload = session.get(Upload, upload_id)
            if upload is None:
                raise HTTPException(status_code=404, detail="Upload was not found.")
            session.expunge(upload)
            return upload

    def presign(self, upload_id: str, part_number: int) -> tuple[str, int]:
        upload = self._active(upload_id)
        if part_number < 1 or part_number > upload.part_count:
            raise HTTPException(status_code=422, detail="Part number is outside the upload range.")
        remaining = int((self._utc(upload.expires_at) - datetime.now(UTC)).total_seconds())
        ttl = min(self._settings.upload_url_ttl_seconds, remaining)
        return (
            self._storage.presign_part(upload.object_key, upload.multipart_id, part_number, ttl),
            ttl,
        )

    def complete(self, upload_id: str, parts: list[CompletedPart]) -> Upload:
        upload = self._active(upload_id)
        ordered = sorted((part.part_number, part.etag.strip()) for part in parts)
        if [number for number, _ in ordered] != list(range(1, upload.part_count + 1)):
            raise HTTPException(status_code=422, detail="All upload parts must be supplied once.")
        if any(not etag for _, etag in ordered):
            raise HTTPException(status_code=422, detail="Part ETags cannot be empty.")
        self._storage.complete_multipart(upload.object_key, upload.multipart_id, ordered)
        now = datetime.now(UTC)
        with self._sessions.begin() as session:
            stored = session.get(Upload, upload_id)
            assert stored is not None
            session.add_all(
                UploadPart(upload_id=upload_id, part_number=number, etag=etag)
                for number, etag in ordered
            )
            stored.status = UploadStatus.COMPLETED
            stored.completed_at = now
        return self.get(upload_id)

    def abort(self, upload_id: str) -> Upload:
        upload = self._active(upload_id)
        self._storage.abort_multipart(upload.object_key, upload.multipart_id)
        with self._sessions.begin() as session:
            stored = session.get(Upload, upload_id)
            assert stored is not None
            stored.status = UploadStatus.ABORTED
        return self.get(upload_id)

    def _active(self, upload_id: str) -> Upload:
        upload = self.get(upload_id)
        if upload.status != UploadStatus.UPLOADING:
            raise HTTPException(status_code=409, detail="Upload is no longer active.")
        if self._utc(upload.expires_at) <= datetime.now(UTC):
            with self._sessions.begin() as session:
                stored = session.execute(select(Upload).where(Upload.id == upload_id)).scalar_one()
                stored.status = UploadStatus.EXPIRED
            raise HTTPException(status_code=410, detail="Upload has expired.")
        return upload

    @staticmethod
    def _utc(value: datetime) -> datetime:
        # SQLite drops timezone information; PostgreSQL preserves it.
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

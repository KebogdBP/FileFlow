from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session, sessionmaker

from fileflow_api.config import Settings
from fileflow_api.imports.contracts import ImportCreate
from fileflow_api.imports.downloader import ImportClient
from fileflow_api.imports.models import ImportStatus, SocialImport
from fileflow_api.imports.url_policy import validate_social_url
from fileflow_api.jobs.queue import TaskQueue
from fileflow_api.uploads.models import SafetyStatus, Upload, UploadStatus
from fileflow_api.uploads.storage import ObjectStorage


class SocialImportService:
    def __init__(
        self,
        sessions: sessionmaker[Session],
        storage: ObjectStorage,
        queue: TaskQueue,
        client: ImportClient,
        settings: Settings,
    ) -> None:
        self._sessions = sessions
        self._storage = storage
        self._queue = queue
        self._client = client
        self._settings = settings

    def create(self, request: ImportCreate) -> SocialImport:
        provider, url = validate_social_url(str(request.url))
        item = SocialImport(
            id=uuid4().hex,
            source_url=url,
            provider=provider,
            status=ImportStatus.QUEUED,
            task_id=None,
            upload_id=None,
            title=None,
            creator=None,
            thumbnail_url=None,
            error_code=None,
            created_at=datetime.now(UTC),
            finished_at=None,
        )
        with self._sessions.begin() as session:
            session.add(item)
        try:
            task_id = self._queue.enqueue_import(item.id)
        except Exception:
            self._fail(item.id, "queue_unavailable")
            raise HTTPException(status_code=503, detail="Import queue is unavailable.") from None
        with self._sessions.begin() as session:
            stored = session.get(SocialImport, item.id)
            assert stored is not None
            stored.task_id = task_id
        return self.get(item.id)

    def get(self, import_id: str) -> SocialImport:
        with self._sessions() as session:
            item = session.get(SocialImport, import_id)
            if item is None:
                raise HTTPException(status_code=404, detail="Import was not found.")
            session.expunge(item)
            return item

    def execute(self, import_id: str) -> SocialImport:
        with self._sessions.begin() as session:
            item = session.get(SocialImport, import_id)
            if item is None or item.status != ImportStatus.QUEUED:
                raise HTTPException(status_code=409, detail="Import cannot be started.")
            item.status = ImportStatus.RUNNING
        item = self.get(import_id)
        key = f"temporary/imports/{item.id}/source"
        uploaded = False
        try:
            with TemporaryDirectory(prefix=f"fileflow-import-{item.id}-") as directory:
                media = self._client.download(
                    item.source_url, Path(directory), self._settings.max_upload_bytes
                )
                size = media.path.stat().st_size
                self._storage.upload_file(key, media.path, "video/mp4")
                uploaded = True
            now = datetime.now(UTC)
            upload = Upload(
                id=uuid4().hex,
                object_key=key,
                multipart_id=f"social-import:{item.id}",
                filename="imported-video.mp4",
                content_type="video/mp4",
                size_bytes=size,
                part_size_bytes=size,
                part_count=1,
                status=UploadStatus.COMPLETED,
                created_at=now,
                expires_at=now + timedelta(seconds=self._settings.upload_retention_seconds),
                completed_at=now,
                safety_status=SafetyStatus.PENDING,
                detected_content_type=None,
                rejection_reason=None,
                scanned_at=None,
            )
            with self._sessions.begin() as session:
                stored = session.get(SocialImport, item.id)
                assert stored is not None
                session.add(upload)
                stored.status = ImportStatus.COMPLETED
                stored.upload_id = upload.id
                stored.title = media.title
                stored.creator = media.creator
                stored.thumbnail_url = media.thumbnail_url
                stored.finished_at = now
        except Exception:
            if uploaded:
                self._storage.delete_object(key)
            self._fail(item.id, "import_failed")
            raise
        try:
            self._queue.enqueue_safety(upload.id)
        except Exception:
            with self._sessions.begin() as session:
                stored_upload = session.get(Upload, upload.id)
                assert stored_upload is not None
                stored_upload.safety_status = SafetyStatus.ERROR
                stored_upload.rejection_reason = "queue_unavailable"
        return self.get(item.id)

    def _fail(self, import_id: str, code: str) -> SocialImport:
        with self._sessions.begin() as session:
            item = session.get(SocialImport, import_id)
            assert item is not None
            item.status = ImportStatus.FAILED
            item.error_code = code
            item.finished_at = datetime.now(UTC)
        return self.get(import_id)

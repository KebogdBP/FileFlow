import base64
import hashlib
import hmac
import json
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory, mkdtemp
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session, sessionmaker

from fileflow_api.config import Settings
from fileflow_api.imports.contracts import DirectDownloadTicket, ImportCreate
from fileflow_api.imports.downloader import (
    ImportClient,
    ImportDownloadError,
    ImportedMedia,
    ImportOptions,
)
from fileflow_api.imports.models import ImportStatus, SocialImport
from fileflow_api.imports.url_policy import (
    COMMENT_PROVIDERS,
    validate_public_url,
    validate_social_url,
)
from fileflow_api.jobs.queue import TaskQueue
from fileflow_api.uploads.models import SafetyStatus, Upload, UploadStatus
from fileflow_api.uploads.storage import ObjectStorage


@dataclass(frozen=True)
class PreparedDirectDownload:
    media: ImportedMedia
    workspace: Path

    def cleanup(self) -> None:
        shutil.rmtree(self.workspace, ignore_errors=True)


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

    def create_direct_ticket(self, request: ImportCreate) -> DirectDownloadTicket:
        provider, url = (
            validate_public_url(str(request.url))
            if request.generic_audio
            else validate_social_url(str(request.url))
        )
        if request.media_type == "comments" and provider not in COMMENT_PROVIDERS:
            raise HTTPException(status_code=422, detail="comments_unsupported")
        expires_at = datetime.now(UTC) + timedelta(
            seconds=self._settings.direct_download_ticket_ttl_seconds
        )
        payload = request.model_dump(mode="json")
        payload["url"] = url
        payload["expires_at"] = int(expires_at.timestamp())
        encoded = _urlsafe_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signature = hmac.new(
            self._settings.s3_secret_key.encode("utf-8"),
            encoded.encode("ascii"),
            hashlib.sha256,
        ).digest()
        ticket = f"{encoded}.{_urlsafe_encode(signature)}"
        return DirectDownloadTicket(
            download_path=f"/imports/direct/{ticket}",
            expires_at=expires_at,
        )

    def prepare_direct_download(self, ticket: str) -> PreparedDirectDownload:
        request = self._direct_request(ticket)
        workspace = Path(mkdtemp(prefix="fileflow-direct-"))
        try:
            media = self._client.download(
                str(request.url),
                workspace,
                None,
                _import_options(request, self._settings),
            )
            return PreparedDirectDownload(media=media, workspace=workspace)
        except Exception:
            shutil.rmtree(workspace, ignore_errors=True)
            raise

    def _direct_request(self, ticket: str) -> ImportCreate:
        try:
            encoded, supplied_signature = ticket.split(".", 1)
            expected_signature = hmac.new(
                self._settings.s3_secret_key.encode("utf-8"),
                encoded.encode("ascii"),
                hashlib.sha256,
            ).digest()
            if not hmac.compare_digest(
                expected_signature,
                _urlsafe_decode(supplied_signature),
            ):
                raise ValueError("invalid signature")
            payload = json.loads(_urlsafe_decode(encoded))
            expires_at = int(payload.pop("expires_at"))
            if expires_at < int(datetime.now(UTC).timestamp()):
                raise ValueError("expired ticket")
            request = ImportCreate.model_validate(payload)
        except (TypeError, ValueError, KeyError, json.JSONDecodeError):
            raise HTTPException(
                status_code=410,
                detail="Direct download ticket is invalid or expired.",
            ) from None
        if request.generic_audio:
            validate_public_url(str(request.url))
        else:
            validate_social_url(str(request.url))
        return request

    def create(self, request: ImportCreate) -> SocialImport:
        provider, url = (
            validate_public_url(str(request.url))
            if request.generic_audio
            else validate_social_url(str(request.url))
        )
        if request.media_type == "comments" and provider not in COMMENT_PROVIDERS:
            raise HTTPException(status_code=422, detail="comments_unsupported")
        item = SocialImport(
            id=uuid4().hex,
            source_url=url,
            provider=provider,
            status=ImportStatus.QUEUED,
            progress=0,
            task_id=None,
            upload_id=None,
            title=None,
            creator=None,
            thumbnail_url=None,
            media_type=request.media_type,
            video_quality=request.video_quality,
            audio_bitrate_kbps=request.audio_bitrate_kbps,
            start_seconds=request.start_seconds,
            end_seconds=request.end_seconds,
            playlist_item=request.playlist_item,
            playlist_count=request.playlist_count,
            generic_audio=request.generic_audio,
            subtitle_language=request.subtitle_language,
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
            item.progress = 2
        item = self.get(import_id)
        key = f"temporary/imports/{item.id}/source"
        uploaded = False
        reported_progress = 2

        def report_progress(value: int) -> None:
            nonlocal reported_progress
            bounded = min(95, max(2, value))
            if bounded > reported_progress:
                reported_progress = bounded
                self._progress(item.id, bounded)

        try:
            with TemporaryDirectory(prefix=f"fileflow-import-{item.id}-") as directory:
                media = self._client.download(
                    item.source_url,
                    Path(directory),
                    self._settings.max_upload_bytes,
                    _import_options(item, self._settings),
                    report_progress,
                )
                size = media.path.stat().st_size
                self._storage.upload_file(key, media.path, media.content_type)
                uploaded = True
            now = datetime.now(UTC)
            upload = Upload(
                id=uuid4().hex,
                object_key=key,
                multipart_id=f"social-import:{item.id}",
                filename=media.filename,
                content_type=media.content_type,
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
                # There is no ORM relationship between these models, so
                # SQLAlchemy cannot infer that Upload must be inserted first.
                session.flush()
                stored.status = ImportStatus.COMPLETED
                stored.progress = 100
                stored.upload_id = upload.id
                stored.title = media.title
                stored.creator = media.creator
                stored.thumbnail_url = media.thumbnail_url
                stored.finished_at = now
        except ImportDownloadError as error:
            if uploaded:
                self._storage.delete_object(key)
            self._fail(item.id, error.code)
            raise
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

    def downloadable_upload(self, import_id: str) -> Upload:
        with self._sessions() as session:
            item = session.get(SocialImport, import_id)
            if item is None:
                raise HTTPException(status_code=404, detail="Import was not found.")
            if item.status != ImportStatus.COMPLETED or item.upload_id is None:
                raise HTTPException(status_code=409, detail="Import is not ready.")
            upload = session.get(Upload, item.upload_id)
            if upload is None or upload.status != UploadStatus.COMPLETED:
                raise HTTPException(status_code=409, detail="Imported media is not available.")
            if upload.safety_status != SafetyStatus.CLEAN:
                raise HTTPException(
                    status_code=409,
                    detail="Imported media has not passed the safety scan.",
                )
            session.expunge(upload)
            return upload

    def _fail(self, import_id: str, code: str) -> SocialImport:
        with self._sessions.begin() as session:
            item = session.get(SocialImport, import_id)
            assert item is not None
            item.status = ImportStatus.FAILED
            item.error_code = code
            item.finished_at = datetime.now(UTC)
        return self.get(import_id)

    def _progress(self, import_id: str, value: int) -> None:
        bounded = min(95, max(2, value))
        with self._sessions.begin() as session:
            item = session.get(SocialImport, import_id)
            if item is not None and item.status == ImportStatus.RUNNING and bounded > item.progress:
                item.progress = bounded


def _import_options(request: ImportCreate | SocialImport, settings: Settings) -> ImportOptions:
    return ImportOptions(
        media_type=request.media_type,
        video_quality=request.video_quality,
        audio_bitrate_kbps=request.audio_bitrate_kbps,
        start_seconds=request.start_seconds,
        end_seconds=request.end_seconds,
        playlist_item=request.playlist_item,
        playlist_count=request.playlist_count,
        generic_audio=request.generic_audio,
        subtitle_language=request.subtitle_language,
        comment_limit=settings.social_import_max_comments,
        comment_character_limit=settings.social_import_max_comment_characters,
    )


def _urlsafe_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _urlsafe_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")

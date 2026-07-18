from collections.abc import Iterator
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session, sessionmaker

from fileflow_api.config import Settings
from fileflow_api.safety.scanner import MalwareScanner, MalwareVerdict
from fileflow_api.safety.signatures import detect_content_type, signature_matches
from fileflow_api.uploads.models import SafetyStatus, Upload, UploadStatus
from fileflow_api.uploads.storage import ObjectStorage


class SafetyService:
    def __init__(
        self,
        sessions: sessionmaker[Session],
        storage: ObjectStorage,
        scanner: MalwareScanner,
        settings: Settings,
    ) -> None:
        self._sessions = sessions
        self._storage = storage
        self._scanner = scanner
        self._settings = settings

    def inspect(self, upload_id: str) -> Upload:
        upload = self._claim(upload_id)
        try:
            if self._storage.object_size(upload.object_key) != upload.size_bytes:
                return self._reject(upload, "size_mismatch", None)
            chunks = self._storage.iter_object(upload.object_key)
            header, replay = self._peek(chunks, self._settings.safety_header_bytes)
            detected = detect_content_type(header)
            if detected is None or not signature_matches(upload.content_type, detected):
                return self._reject(upload, "signature_mismatch", detected)
            scan = self._scanner.scan(replay)
            if scan.verdict == MalwareVerdict.INFECTED:
                reason = f"malware:{scan.threat or 'detected'}"
                return self._reject(upload, reason[:255], detected)
            return self._finish(upload.id, SafetyStatus.CLEAN, detected, None)
        except Exception:
            self._finish(upload.id, SafetyStatus.ERROR, None, "scanner_unavailable")
            raise

    def require_clean(self, upload_id: str) -> Upload:
        upload = self._get(upload_id)
        if upload.safety_status != SafetyStatus.CLEAN:
            raise HTTPException(status_code=409, detail="Upload has not passed safety checks.")
        return upload

    def _claim(self, upload_id: str) -> Upload:
        with self._sessions.begin() as session:
            upload = session.get(Upload, upload_id)
            if upload is None:
                raise HTTPException(status_code=404, detail="Upload was not found.")
            if upload.status != UploadStatus.COMPLETED:
                raise HTTPException(status_code=409, detail="Upload is not complete.")
            if upload.safety_status != SafetyStatus.PENDING:
                raise HTTPException(status_code=409, detail="Safety check already started.")
            upload.safety_status = SafetyStatus.SCANNING
        return self._get(upload_id)

    def _reject(self, upload: Upload, reason: str, detected: str | None) -> Upload:
        self._storage.delete_object(upload.object_key)
        return self._finish(upload.id, SafetyStatus.REJECTED, detected, reason)

    def _finish(
        self, upload_id: str, status: SafetyStatus, detected: str | None, reason: str | None
    ) -> Upload:
        with self._sessions.begin() as session:
            upload = session.get(Upload, upload_id)
            assert upload is not None
            upload.safety_status = status
            upload.detected_content_type = detected
            upload.rejection_reason = reason
            upload.scanned_at = datetime.now(UTC)
        return self._get(upload_id)

    def _get(self, upload_id: str) -> Upload:
        with self._sessions() as session:
            upload = session.get(Upload, upload_id)
            if upload is None:
                raise HTTPException(status_code=404, detail="Upload was not found.")
            session.expunge(upload)
            return upload

    @staticmethod
    def _peek(chunks: Iterator[bytes], limit: int) -> tuple[bytes, Iterator[bytes]]:
        buffered: list[bytes] = []
        size = 0
        while size < limit:
            try:
                chunk = next(chunks)
            except StopIteration:
                break
            buffered.append(chunk)
            size += len(chunk)

        def replay() -> Iterator[bytes]:
            yield from buffered
            yield from chunks

        return b"".join(buffered)[:limit], replay()

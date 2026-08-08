from collections.abc import Iterable, Iterator

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from fileflow_api.config import Settings
from fileflow_api.database import Base, build_session_factory
from fileflow_api.safety.scanner import MalwareVerdict, ScanResult
from fileflow_api.safety.service import SafetyService
from fileflow_api.uploads.contracts import CompletedPart, UploadCreate
from fileflow_api.uploads.models import SafetyStatus
from fileflow_api.uploads.service import UploadService


class MemoryStorage:
    def __init__(self, content: bytes) -> None:
        self.content = content
        self.deleted = False

    def create_multipart(self, key: str, content_type: str) -> str:
        return "multipart"

    def presign_part(self, key: str, upload_id: str, part_number: int, ttl: int) -> str:
        return "https://storage.test/part"

    def complete_multipart(self, key: str, upload_id: str, parts: list[tuple[int, str]]) -> None:
        pass

    def abort_multipart(self, key: str, upload_id: str) -> None:
        pass

    def object_size(self, key: str) -> int:
        return len(self.content)

    def iter_object(self, key: str, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        midpoint = max(1, len(self.content) // 2)
        yield self.content[:midpoint]
        yield self.content[midpoint:]

    def delete_object(self, key: str) -> None:
        self.deleted = True


class FakeScanner:
    def __init__(self, result: ScanResult) -> None:
        self.result = result
        self.received = b""

    def scan(self, chunks: Iterable[bytes]) -> ScanResult:
        self.received = b"".join(chunks)
        return self.result


def safety_service(
    content: bytes, content_type: str, scan: ScanResult
) -> tuple[SafetyService, str, MemoryStorage, FakeScanner]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = build_session_factory(engine)
    settings = Settings(environment="test", safety_header_bytes=512)
    storage = MemoryStorage(content)
    upload_service = UploadService(sessions, storage, settings)
    upload = upload_service.create(
        UploadCreate(filename="source.bin", content_type=content_type, size_bytes=len(content))
    )
    upload_service.complete(upload.id, [CompletedPart(part_number=1, etag='"etag"')])
    scanner = FakeScanner(scan)
    return SafetyService(sessions, storage, scanner, settings), upload.id, storage, scanner


def test_clean_file_is_streamed_and_released() -> None:
    content = b"\x89PNG\r\n\x1a\n" + b"safe-image-content" * 100
    service, upload_id, storage, scanner = safety_service(
        content, "image/png", ScanResult(MalwareVerdict.CLEAN)
    )
    upload = service.inspect(upload_id)
    assert upload.safety_status == SafetyStatus.CLEAN
    assert upload.detected_content_type == "image/png"
    assert scanner.received == content
    assert not storage.deleted
    assert service.require_clean(upload_id).id == upload_id


def test_webvtt_subtitles_pass_the_existing_malware_pipeline() -> None:
    content = b"WEBVTT\n\n00:00.000 --> 00:01.000\nHello"
    service, upload_id, storage, scanner = safety_service(
        content, "text/vtt", ScanResult(MalwareVerdict.CLEAN)
    )
    upload = service.inspect(upload_id)
    assert upload.safety_status == SafetyStatus.CLEAN
    assert upload.detected_content_type == "text/vtt"
    assert scanner.received == content
    assert not storage.deleted


@pytest.mark.parametrize(
    ("content", "declared", "result", "reason"),
    [
        (
            b"%PDF-1.7 suspicious",
            "image/png",
            ScanResult(MalwareVerdict.CLEAN),
            "signature_mismatch",
        ),
        (
            b"\xff\xd8\xffpayload",
            "image/jpeg",
            ScanResult(MalwareVerdict.INFECTED, "Eicar-Test-Signature"),
            "malware:Eicar-Test-Signature",
        ),
    ],
)
def test_unsafe_object_is_rejected_and_deleted(
    content: bytes, declared: str, result: ScanResult, reason: str
) -> None:
    service, upload_id, storage, _ = safety_service(content, declared, result)
    upload = service.inspect(upload_id)
    assert upload.safety_status == SafetyStatus.REJECTED
    assert upload.rejection_reason == reason
    assert storage.deleted
    with pytest.raises(HTTPException, match="not passed"):
        service.require_clean(upload_id)


def test_declared_size_mismatch_is_rejected_before_scan() -> None:
    content = b"\x89PNG\r\n\x1a\ncontent"
    service, upload_id, storage, scanner = safety_service(
        content, "image/png", ScanResult(MalwareVerdict.CLEAN)
    )
    storage.content += b"tampered"
    upload = service.inspect(upload_id)
    assert upload.rejection_reason == "size_mismatch"
    assert scanner.received == b""

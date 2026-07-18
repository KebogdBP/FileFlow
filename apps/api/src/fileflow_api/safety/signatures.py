from dataclasses import dataclass


@dataclass(frozen=True)
class Signature:
    content_type: str
    offset: int
    magic: bytes


SIGNATURES = (
    Signature("image/jpeg", 0, b"\xff\xd8\xff"),
    Signature("image/png", 0, b"\x89PNG\r\n\x1a\n"),
    Signature("image/gif", 0, b"GIF87a"),
    Signature("image/gif", 0, b"GIF89a"),
    Signature("application/pdf", 0, b"%PDF-"),
    Signature("audio/wav", 0, b"RIFF"),
    Signature("audio/ogg", 0, b"OggS"),
    Signature("audio/mpeg", 0, b"ID3"),
    Signature("video/mp4", 4, b"ftyp"),
)


def detect_content_type(header: bytes) -> str | None:
    if header.startswith(b"PK\x03\x04"):
        return "application/zip"
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "image/webp"
    for signature in SIGNATURES:
        start = signature.offset
        if header[start : start + len(signature.magic)] == signature.magic:
            return signature.content_type
    if header.startswith((b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")):
        return "audio/mpeg"
    return None


def signature_matches(declared: str, detected: str) -> bool:
    if declared == detected:
        return True
    aliases = {
        "audio/mp3": "audio/mpeg",
        "video/quicktime": "video/mp4",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
            "application/zip"
        ),
    }
    return aliases.get(declared) == detected

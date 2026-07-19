from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from yt_dlp import YoutubeDL


@dataclass(frozen=True)
class ImportedMedia:
    path: Path
    title: str | None
    creator: str | None
    thumbnail_url: str | None


class ImportClient(Protocol):
    def download(self, url: str, workspace: Path, max_bytes: int) -> ImportedMedia: ...


class YtDlpClient:
    def download(self, url: str, workspace: Path, max_bytes: int) -> ImportedMedia:
        options: dict[str, Any] = {
            "format": "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]",
            "merge_output_format": "mp4",
            "outtmpl": str(workspace / "source.%(ext)s"),
            "max_filesize": max_bytes,
            "socket_timeout": 20,
            "retries": 3,
            "fragment_retries": 3,
            "quiet": True,
            "no_warnings": True,
            "restrictfilenames": True,
            "overwrites": False,
        }
        with YoutubeDL(options) as downloader:
            raw = downloader.extract_info(url, download=True)
        if not isinstance(raw, dict):
            raise ValueError("extractor returned invalid media metadata")
        files = [path for path in workspace.iterdir() if path.is_file() and not path.is_symlink()]
        if len(files) != 1 or files[0].suffix.lower() != ".mp4":
            raise ValueError("import did not produce one MP4 artifact")
        media = files[0]
        if media.stat().st_size <= 0 or media.stat().st_size > max_bytes:
            raise ValueError("imported media violates size limits")
        with media.open("rb") as downloaded:
            header = downloaded.read(12)
        if len(header) < 8 or header[4:8] != b"ftyp":
            raise ValueError("imported media is not an MP4 container")

        def text(name: str, limit: int) -> str | None:
            value = raw.get(name)
            return str(value)[:limit] if value else None

        return ImportedMedia(
            media, text("title", 500), text("uploader", 255), text("thumbnail", 2048)
        )

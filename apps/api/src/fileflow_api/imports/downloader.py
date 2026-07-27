import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# The reference downloader needs this escape hatch when an installed third-party
# plugin intercepts otherwise valid requests. It is opt-in because FileFlow's
# production YouTube path intentionally uses the bgutil PO-token plugin.
if os.getenv("FILEFLOW_SOCIAL_IMPORT_DISABLE_PLUGINS", "").lower() in {"1", "true", "yes"}:
    os.environ["YTDLP_NO_PLUGINS"] = "1"

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError, download_range_func


@dataclass(frozen=True)
class ImportOptions:
    media_type: str = "video"
    video_quality: str = "best"
    audio_bitrate_kbps: int = 192
    start_seconds: float | None = None
    end_seconds: float | None = None
    playlist_item: int | None = None


@dataclass(frozen=True)
class ImportedMedia:
    path: Path
    content_type: str
    filename: str
    title: str | None
    creator: str | None
    thumbnail_url: str | None


class ImportDownloadError(RuntimeError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


class ImportClient(Protocol):
    def download(
        self, url: str, workspace: Path, max_bytes: int, options: ImportOptions
    ) -> ImportedMedia: ...


class YtDlpClient:
    def __init__(
        self,
        cookies_file: str | None = None,
        pot_provider_url: str | None = None,
        proxy_url: str | None = None,
        allow_remote_ejs: bool = True,
    ) -> None:
        if cookies_file is not None and not Path(cookies_file).is_absolute():
            raise ValueError("social import cookies path must be absolute")
        self._cookies_file = cookies_file
        self._pot_provider_url = pot_provider_url.rstrip("/") if pot_provider_url else None
        self._proxy_url = proxy_url or None
        self._allow_remote_ejs = allow_remote_ejs

    def download(
        self,
        url: str,
        workspace: Path,
        max_bytes: int,
        import_options: ImportOptions | None = None,
    ) -> ImportedMedia:
        selected = import_options or ImportOptions()
        source_url = url if selected.playlist_item is not None else _single_video_url(url)
        hostname = (urlsplit(source_url).hostname or "").lower()
        is_youtube = (
            hostname == "youtu.be" or hostname == "youtube.com" or hostname.endswith(".youtube.com")
        )
        postprocessors: list[dict[str, Any]]
        if selected.media_type == "audio":
            postprocessors = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": str(selected.audio_bitrate_kbps),
                }
            ]
            format_spec = "bestaudio/best"
        else:
            postprocessors = [
                {
                    "key": "FFmpegVideoRemuxer",
                    "preferedformat": "mp4",
                }
            ]
            format_spec = _video_format(selected.video_quality)
        options: dict[str, Any] = {
            "format": format_spec,
            "merge_output_format": "mp4",
            "postprocessors": postprocessors,
            "outtmpl": str(workspace / "source.%(ext)s"),
            "max_filesize": max_bytes,
            "socket_timeout": 20,
            "retries": 5,
            "fragment_retries": 5,
            "extractor_retries": 5,
            "file_access_retries": 3,
            "quiet": True,
            "no_warnings": True,
            "restrictfilenames": True,
            "overwrites": False,
            "noplaylist": selected.playlist_item is None,
        }
        if selected.playlist_item is not None:
            options["playlist_items"] = str(selected.playlist_item)
        if selected.start_seconds is not None or selected.end_seconds is not None:
            options["download_ranges"] = download_range_func(
                None,
                [(selected.start_seconds or 0, selected.end_seconds)],
            )
            options["force_keyframes_at_cuts"] = True
        if is_youtube:
            options.update(_javascript_options(self._allow_remote_ejs))
            if self._pot_provider_url is not None:
                # Current YouTube GVS requests from datacenter IPs require a
                # video-bound Proof-of-Origin token. The provider is an
                # internal-only sidecar; no token or endpoint reaches clients.
                options["extractor_args"] = {
                    "youtube": {
                        "player_client": ["mweb"],
                        "fetch_pot": ["always"],
                    },
                    "youtubepot-bgutilhttp": {
                        "base_url": [self._pot_provider_url],
                    },
                }
        if self._cookies_file is not None:
            cookie_path = Path(self._cookies_file)
            if not cookie_path.is_file():
                raise ImportDownloadError("platform_auth_unavailable")
            options["cookiefile"] = str(cookie_path)
        if self._proxy_url is not None:
            options["proxy"] = self._proxy_url
        attempts = [options]
        if is_youtube:
            # The reference downloader uses the public YouTube TV client
            # without cookies or a PO token. Retain the POT-backed mweb path
            # as the primary datacenter profile and use TV as a fallback.
            tv_options = dict(options)
            tv_options["extractor_args"] = {"youtube": {"player_client": ["tv"]}}
            tv_options.pop("cookiefile", None)
            attempts.append(tv_options)

        raw: dict[str, Any] | None = None
        last_error: DownloadError | None = None
        for attempt, attempt_options in enumerate(attempts):
            if attempt:
                _clear_download_workspace(workspace)
            try:
                with YoutubeDL(attempt_options) as downloader:
                    extracted = downloader.extract_info(source_url, download=True)
                if not isinstance(extracted, dict):
                    raise ValueError("extractor returned invalid media metadata")
                raw = extracted
                break
            except DownloadError as error:
                last_error = error
        if raw is None:
            assert last_error is not None
            raise ImportDownloadError(_download_error_code(str(last_error))) from last_error
        files = [path for path in workspace.iterdir() if path.is_file() and not path.is_symlink()]
        expected_suffix = ".mp3" if selected.media_type == "audio" else ".mp4"
        if len(files) != 1 or files[0].suffix.lower() != expected_suffix:
            raise ValueError(f"import did not produce one {expected_suffix} artifact")
        media = files[0]
        if media.stat().st_size <= 0 or media.stat().st_size > max_bytes:
            raise ValueError("imported media violates size limits")
        with media.open("rb") as downloaded:
            header = downloaded.read(12)
        if selected.media_type == "audio":
            if not _is_mp3_header(header):
                raise ValueError("imported media is not an MP3 file")
            content_type = "audio/mpeg"
            filename = "imported-audio.mp3"
        else:
            if len(header) < 8 or header[4:8] != b"ftyp":
                raise ValueError("imported media is not an MP4 container")
            content_type = "video/mp4"
            filename = "imported-video.mp4"

        def text(name: str, limit: int) -> str | None:
            value = raw.get(name)
            return str(value)[:limit] if value else None

        return ImportedMedia(
            media,
            content_type,
            filename,
            text("title", 500),
            text("uploader", 255),
            text("thumbnail", 2048),
        )


def _javascript_options(allow_remote_ejs: bool) -> dict[str, Any]:
    for runtime in ("deno", "node", "bun", "qjs"):
        runtime_path = shutil.which(runtime)
        if runtime_path:
            result: dict[str, Any] = {"js_runtimes": {runtime: {"path": runtime_path}}}
            if allow_remote_ejs:
                result["remote_components"] = ["ejs:github"]
            return result
    return {}


def _video_format(quality: str) -> str:
    height = "" if quality == "best" else f"[height<={int(quality)}]"
    bounded = (
        f"bestvideo[ext=mp4]{height}+bestaudio[ext=m4a]/"
        f"bestvideo[ext=webm]{height}+bestaudio[ext=webm]/"
        f"bestvideo{height}+bestaudio/best[ext=mp4]{height}/best{height}"
    )
    if quality == "best":
        return bounded
    # Short-form platforms often expose only one progressive MP4 at the
    # source resolution. Prefer the requested ceiling, but keep the import
    # functional when the platform offers no rendition at or below it.
    return f"{bounded}/best[ext=mp4]/best"


def _is_mp3_header(header: bytes) -> bool:
    return header.startswith(b"ID3") or header.startswith((b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"))


def _clear_download_workspace(workspace: Path) -> None:
    for path in workspace.iterdir():
        if path.is_file() and not path.is_symlink():
            path.unlink()


def _single_video_url(url: str) -> str:
    parts = urlsplit(url)
    hostname = (parts.hostname or "").lower()
    if hostname == "youtube.com" or hostname.endswith(".youtube.com"):
        query = [
            (name, value)
            for name, value in parse_qsl(parts.query, keep_blank_values=True)
            if name not in {"list", "start_radio", "index"}
        ]
        return urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
        )
    return url


def _download_error_code(message: str) -> str:
    normalized = message.lower()
    if "ip address is blocked" in normalized or "blocked from accessing" in normalized:
        return "platform_ip_blocked"
    if (
        "sign in to confirm" in normalized
        or "cookies for the authentication" in normalized
        or "empty media response" in normalized
        or "locked behind the login page" in normalized
    ):
        return "platform_auth_required"
    if "video unavailable" in normalized or "media is not available" in normalized:
        return "media_unavailable"
    if "requested format is not available" in normalized:
        return "supported_format_unavailable"
    return "import_failed"

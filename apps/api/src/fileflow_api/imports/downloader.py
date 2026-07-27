from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError


@dataclass(frozen=True)
class ImportedMedia:
    path: Path
    title: str | None
    creator: str | None
    thumbnail_url: str | None


class ImportDownloadError(RuntimeError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


class ImportClient(Protocol):
    def download(self, url: str, workspace: Path, max_bytes: int) -> ImportedMedia: ...


class YtDlpClient:
    def __init__(
        self,
        cookies_file: str | None = None,
        pot_provider_url: str | None = None,
        proxy_url: str | None = None,
    ) -> None:
        if cookies_file is not None and not Path(cookies_file).is_absolute():
            raise ValueError("social import cookies path must be absolute")
        self._cookies_file = cookies_file
        self._pot_provider_url = pot_provider_url.rstrip("/") if pot_provider_url else None
        self._proxy_url = proxy_url or None

    def download(self, url: str, workspace: Path, max_bytes: int) -> ImportedMedia:
        source_url = _single_video_url(url)
        hostname = (urlsplit(source_url).hostname or "").lower()
        is_youtube = (
            hostname == "youtu.be" or hostname == "youtube.com" or hostname.endswith(".youtube.com")
        )
        options: dict[str, Any] = {
            # Prefer an MP4/M4A pair, but do not fail when YouTube only exposes
            # WebM or another DASH combination. The remuxer below normalizes
            # every successful fallback to the single MP4 artifact required by
            # FileFlow's storage and safety pipeline.
            "format": (
                "bestvideo[ext=mp4]+bestaudio[ext=m4a]/"
                "bestvideo[ext=webm]+bestaudio[ext=webm]/"
                "bestvideo+bestaudio/best[ext=mp4]/best"
            ),
            "merge_output_format": "mp4",
            "postprocessors": [
                {
                    "key": "FFmpegVideoRemuxer",
                    "preferedformat": "mp4",
                }
            ],
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
            "noplaylist": True,
        }
        if is_youtube:
            # yt-dlp enables Deno by default, not Node. The worker image ships
            # Node 22, so it must be explicitly enabled for YouTube's current
            # JavaScript signature and n-challenge solvers. Keep yt-dlp's
            # current default client selection: forcing the TV client can make
            # otherwise public videos appear DRM-protected.
            options["js_runtimes"] = {"node": {}}
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
    if "sign in to confirm" in normalized or "cookies for the authentication" in normalized:
        return "platform_auth_required"
    if "video unavailable" in normalized or "media is not available" in normalized:
        return "media_unavailable"
    if "requested format is not available" in normalized:
        return "supported_format_unavailable"
    return "import_failed"

import os
import shutil
from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zipfile import ZIP_DEFLATED, ZipFile

# The reference downloader needs this escape hatch when an installed third-party
# plugin intercepts otherwise valid requests. It is opt-in because FileFlow's
# production YouTube path intentionally uses the bgutil PO-token plugin.
if os.getenv("FILEFLOW_SOCIAL_IMPORT_DISABLE_PLUGINS", "").lower() in {"1", "true", "yes"}:
    os.environ["YTDLP_NO_PLUGINS"] = "1"

from yt_dlp import YoutubeDL
from yt_dlp.networking.impersonate import ImpersonateTarget
from yt_dlp.utils import DownloadError, download_range_func

from fileflow_api.downloads import converted_filename

WORKING_COOKIES_FILENAME = ".platform-cookies.txt"


@dataclass(frozen=True)
class ImportOptions:
    media_type: str = "video"
    video_quality: str = "best"
    audio_bitrate_kbps: int = 192
    start_seconds: float | None = None
    end_seconds: float | None = None
    playlist_item: int | None = None
    playlist_count: int | None = None
    generic_audio: bool = False
    subtitle_language: str = "en"
    comment_limit: int = 2_500
    comment_character_limit: int = 380_000


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
        self,
        url: str,
        workspace: Path,
        max_bytes: int,
        options: ImportOptions,
        on_progress: Callable[[int], None] | None = None,
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
        on_progress: Callable[[int], None] | None = None,
    ) -> ImportedMedia:
        selected = import_options or ImportOptions()
        is_playlist = selected.playlist_count is not None
        source_url = (
            url
            if selected.playlist_item is not None or is_playlist or selected.generic_audio
            else _single_video_url(url)
        )
        hostname = (urlsplit(source_url).hostname or "").lower()
        is_youtube = (
            hostname == "youtu.be" or hostname == "youtube.com" or hostname.endswith(".youtube.com")
        )
        browser_impersonation_fallback = hostname in {
            "facebook.com",
            "www.facebook.com",
            "m.facebook.com",
            "web.facebook.com",
            "fb.watch",
            "instagram.com",
            "www.instagram.com",
            "tiktok.com",
            "www.tiktok.com",
            "m.tiktok.com",
            "vm.tiktok.com",
            "vt.tiktok.com",
        }
        postprocessors: list[dict[str, Any]]
        if selected.media_type in {"subtitles", "comments"}:
            postprocessors = []
            format_spec: str | None = None
        elif selected.media_type == "audio":
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
            "merge_output_format": "mp4",
            "postprocessors": postprocessors,
            "outtmpl": str(
                workspace
                / ("source-%(playlist_index)03d.%(ext)s" if is_playlist else "source.%(ext)s")
            ),
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
            "noplaylist": selected.playlist_item is None and not is_playlist,
            "progress_hooks": [_download_progress_hook(on_progress)],
            "postprocessor_hooks": [_postprocessor_progress_hook(on_progress)],
        }
        if format_spec is not None:
            options["format"] = format_spec
        elif selected.media_type == "comments":
            options.update({"skip_download": True, "getcomments": True})
            if is_youtube:
                options["extractor_args"] = {
                    "youtube": {
                        "comment_sort": ["top"],
                        "max_comments": [str(selected.comment_limit)],
                    }
                }
        else:
            options.update(
                {
                    "skip_download": True,
                    "writesubtitles": True,
                    "writeautomaticsub": True,
                    "subtitleslangs": [selected.subtitle_language],
                    "subtitlesformat": "vtt",
                }
            )
        if selected.playlist_item is not None:
            options["playlist_items"] = str(selected.playlist_item)
        elif is_playlist and selected.playlist_count:
            options["playlist_items"] = f"1:{selected.playlist_count}"
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
                extractor_args = options.setdefault("extractor_args", {})
                youtube_args = extractor_args.setdefault("youtube", {})
                youtube_args.update({"player_client": ["mweb"], "fetch_pot": ["always"]})
                extractor_args["youtubepot-bgutilhttp"] = {"base_url": [self._pot_provider_url]}
        if self._cookies_file is not None:
            cookie_path = Path(self._cookies_file)
            if not cookie_path.is_file():
                raise ImportDownloadError("platform_auth_unavailable")
            # yt-dlp persists cookie updates when YoutubeDL closes. Production
            # secrets stay read-only, so give each import a private disposable
            # copy rather than allowing the mounted credential to be modified.
            working_cookies = workspace / WORKING_COOKIES_FILENAME
            shutil.copyfile(cookie_path, working_cookies)
            working_cookies.chmod(0o600)
            options["cookiefile"] = str(working_cookies)
        if self._proxy_url is not None:
            options["proxy"] = self._proxy_url
        attempts = [options]
        if is_youtube:
            # Current public TV responses are frequently DRM-only. Prefer the
            # Safari HLS path (which does not currently require a GVS token),
            # then try embedded playback for videos that allow it.
            safari_options = deepcopy(options)
            safari_args = safari_options.setdefault("extractor_args", {}).setdefault("youtube", {})
            safari_args.update({"player_client": ["web_safari"]})
            safari_args.pop("fetch_pot", None)
            safari_options["extractor_args"].pop("youtubepot-bgutilhttp", None)
            safari_options["impersonate"] = ImpersonateTarget.from_str("safari")
            attempts.append(safari_options)

            embedded_options = deepcopy(options)
            embedded_args = embedded_options.setdefault("extractor_args", {}).setdefault(
                "youtube", {}
            )
            embedded_args.update({"player_client": ["web_embedded"]})
            embedded_args.pop("fetch_pot", None)
            embedded_options["extractor_args"].pop("youtubepot-bgutilhttp", None)
            attempts.append(embedded_options)
        elif browser_impersonation_fallback:
            # Meta and TikTok periodically gate otherwise public pages using a
            # browser TLS fingerprint. Keep the faster native request first,
            # then retry through curl_cffi as a real browser profile.
            impersonated_options = dict(options)
            impersonated_options["impersonate"] = ImpersonateTarget.from_str("chrome")
            attempts.append(impersonated_options)

        raw: dict[str, Any] | None = None
        download_errors: list[str] = []
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
                download_errors.append(str(error))
        if raw is None:
            assert download_errors
            raise ImportDownloadError(_best_download_error_code(download_errors))
        title = _metadata_text(raw, "title", 500)
        creator = _metadata_text(raw, "uploader", 255)
        thumbnail = _metadata_text(raw, "thumbnail", 2048)
        if selected.media_type == "comments":
            comments_path = workspace / "comments.txt"
            comments_path.write_text(
                _comments_document(
                    raw,
                    title,
                    creator,
                    selected.comment_limit,
                    selected.comment_character_limit,
                ),
                encoding="utf-8",
                newline="\n",
            )
        files = [path for path in workspace.iterdir() if path.is_file() and not path.is_symlink()]
        expected_suffix = (
            ".vtt"
            if selected.media_type == "subtitles"
            else ".txt"
            if selected.media_type == "comments"
            else ".mp3"
            if selected.media_type == "audio"
            else ".mp4"
        )
        media_files = sorted(path for path in files if path.suffix.lower() == expected_suffix)
        if not media_files:
            if selected.media_type == "subtitles":
                raise ImportDownloadError("subtitles_not_found")
            if selected.media_type == "comments":
                raise ImportDownloadError("comments_not_found")
            raise ValueError(f"import did not produce a {expected_suffix} artifact")
        if is_playlist:
            archive = workspace / "playlist.zip"
            with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
                for index, path in enumerate(media_files, 1):
                    bundle.write(path, f"{index:03d}-{path.name}")
            for path in media_files:
                path.unlink()
            if archive.stat().st_size <= 0 or archive.stat().st_size > max_bytes:
                raise ValueError("imported playlist violates size limits")
            return ImportedMedia(
                archive,
                "application/zip",
                converted_filename(title or "Playlist", ".zip", source_is_filename=False),
                title,
                creator,
                thumbnail,
            )
        if selected.media_type in {"subtitles", "comments"} and media_files:
            media_files = media_files[:1]
        if len(media_files) != 1:
            raise ValueError(f"import did not produce one {expected_suffix} artifact")
        media = media_files[0]
        if media.stat().st_size <= 0 or media.stat().st_size > max_bytes:
            raise ValueError("imported media violates size limits")
        with media.open("rb") as downloaded:
            header = downloaded.read(12)
        if selected.media_type == "subtitles":
            if not header.startswith(b"WEBVTT"):
                raise ValueError("imported subtitles are not WebVTT")
            content_type = "text/vtt"
            filename = converted_filename(title or "Subtitles", ".vtt", source_is_filename=False)
        elif selected.media_type == "comments":
            content_type = "text/plain"
            filename = converted_filename(
                title or "Community response", ".txt", source_is_filename=False
            )
        elif selected.media_type == "audio":
            if not _is_mp3_header(header):
                raise ValueError("imported media is not an MP3 file")
            content_type = "audio/mpeg"
            filename = converted_filename(title or "Audio", ".mp3", source_is_filename=False)
        else:
            if len(header) < 8 or header[4:8] != b"ftyp":
                raise ValueError("imported media is not an MP4 container")
            content_type = "video/mp4"
            filename = converted_filename(title or "Video", ".mp4", source_is_filename=False)

        return ImportedMedia(
            media,
            content_type,
            filename,
            title,
            creator,
            thumbnail,
        )


def _download_progress_hook(
    on_progress: Callable[[int], None] | None,
) -> Callable[[dict[str, Any]], None]:
    def report(event: dict[str, Any]) -> None:
        if on_progress is None:
            return
        if event.get("status") == "finished":
            on_progress(88)
            return
        if event.get("status") != "downloading":
            return
        downloaded = event.get("downloaded_bytes")
        total = event.get("total_bytes") or event.get("total_bytes_estimate")
        if isinstance(downloaded, (int, float)) and isinstance(total, (int, float)) and total > 0:
            on_progress(min(85, max(5, round(5 + (downloaded / total) * 80))))

    return report


def _postprocessor_progress_hook(
    on_progress: Callable[[int], None] | None,
) -> Callable[[dict[str, Any]], None]:
    def report(event: dict[str, Any]) -> None:
        if on_progress is None:
            return
        on_progress(94 if event.get("status") == "finished" else 90)

    return report


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


def _metadata_text(raw: dict[str, Any], name: str, limit: int) -> str | None:
    value = raw.get(name)
    return str(value)[:limit] if value else None


def _comments_document(
    raw: dict[str, Any],
    title: str | None,
    creator: str | None,
    comment_limit: int,
    character_limit: int,
) -> str:
    comments = _collected_comments(raw)
    if not comments:
        raise ImportDownloadError("comments_not_found")
    available = raw.get("comment_count")
    available_text = str(available) if isinstance(available, int) else "Unknown"
    lines = [
        "FILEFLOW — COMMUNITY RESPONSE",
        f"Video: {title or 'Untitled'}",
        f"Creator: {creator or 'Unknown'}",
        f"Platform: {raw.get('extractor_key') or raw.get('extractor') or 'Unknown'}",
        f"Comments available: {available_text}",
        f"Comments fetched from platform: {min(len(comments), comment_limit)}",
        f"Collection limit: {comment_limit}",
        "Selection: platform-ranked comments and replies",
        "",
    ]
    written = 0
    current_characters = len("\n".join(lines))
    for index, comment in enumerate(comments[:comment_limit], 1):
        text = str(comment.get("text") or "").strip()
        if not text:
            continue
        timestamp = comment.get("timestamp")
        date = "Unknown date"
        if isinstance(timestamp, (int, float)):
            date = datetime.fromtimestamp(timestamp, UTC).strftime("%Y-%m-%d %H:%M UTC")
        author = str(comment.get("author") or "Anonymous").strip()
        likes = comment.get("like_count")
        parent = comment.get("parent")
        metadata = [date]
        if isinstance(likes, int):
            metadata.append(f"likes: {likes}")
        if parent and str(parent) != "root":
            metadata.append("reply")
        block_prefix = [
            f"COMMENT {index}",
            f"Author: {author}",
            f"Metadata: {' | '.join(metadata)}",
        ]
        remaining = character_limit - current_characters - len("\n".join([*block_prefix, ""]))
        if remaining < 80:
            lines.extend(
                [
                    "COLLECTION NOTICE",
                    f"Stopped at {written} comments to keep the file within the AI analysis limit.",
                    "",
                ]
            )
            break
        if len(text) > remaining:
            text = f"{text[: max(1, remaining - 35)]}\n[Comment truncated by FileFlow]"
        block = [*block_prefix, text, ""]
        block_characters = len("\n".join(block)) + 1
        if current_characters + block_characters > character_limit:
            lines.extend(
                [
                    "COLLECTION NOTICE",
                    f"Stopped at {written} comments to keep the file within the AI analysis limit.",
                    "",
                ]
            )
            break
        lines.extend(block)
        current_characters += block_characters
        written += 1
    if written == 0:
        raise ImportDownloadError("comments_not_found")
    lines.insert(6, f"Comments included in this file: {written}")
    return "\n".join(lines)


def _collected_comments(raw: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[Any] = []
    if isinstance(raw.get("comments"), list):
        candidates.extend(raw["comments"])
    entries = raw.get("entries")
    if isinstance(entries, list):
        for entry in entries:
            if isinstance(entry, dict) and isinstance(entry.get("comments"), list):
                candidates.extend(entry["comments"])
    comments: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        key = (
            str(candidate.get("id") or ""),
            str(candidate.get("author") or ""),
            str(candidate.get("text") or ""),
        )
        if key in seen:
            continue
        seen.add(key)
        comments.append(candidate)
    return comments


def _clear_download_workspace(workspace: Path) -> None:
    for path in workspace.iterdir():
        if path.name != WORKING_COOKIES_FILENAME and path.is_file() and not path.is_symlink():
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
    if (
        "larger than max-filesize" in normalized
        or "file is larger than" in normalized
        or "exceeds configured upload limit" in normalized
    ):
        return "media_too_large"
    if "http error 429" in normalized or "rate-limit reached" in normalized:
        return "platform_rate_limited"
    if "ip address is blocked" in normalized or "blocked from accessing" in normalized:
        return "platform_ip_blocked"
    if "cannot parse data" in normalized or "please report this issue" in normalized:
        return "extractor_outdated"
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


def _best_download_error_code(messages: list[str]) -> str:
    codes = {_download_error_code(message) for message in messages}
    for code in (
        "media_too_large",
        "media_unavailable",
        "platform_rate_limited",
        "platform_ip_blocked",
        "platform_auth_required",
        "extractor_outdated",
        "supported_format_unavailable",
    ):
        if code in codes:
            return code
    return "import_failed"

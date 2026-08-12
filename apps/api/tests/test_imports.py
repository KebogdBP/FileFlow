import os
from collections.abc import Callable
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool

from fileflow_api.config import Settings
from fileflow_api.database import Base, build_session_factory
from fileflow_api.imports import downloader as downloader_module
from fileflow_api.imports.contracts import ImportCreate
from fileflow_api.imports.downloader import (
    ImportDownloadError,
    ImportedMedia,
    ImportOptions,
    YtDlpClient,
    _best_download_error_code,
    _download_error_code,
    _single_video_url,
    _video_format,
)
from fileflow_api.imports.models import ImportStatus
from fileflow_api.imports.service import SocialImportService
from fileflow_api.imports.url_policy import validate_public_url, validate_social_url


class FakeStorage:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def upload_file(self, key: str, source: Path, content_type: str) -> None:
        assert content_type in {"video/mp4", "audio/mpeg", "application/zip"}
        self.objects[key] = source.read_bytes()

    def delete_object(self, key: str) -> None:
        self.objects.pop(key, None)


class FakeQueue:
    def __init__(self) -> None:
        self.imports: list[str] = []
        self.safety: list[str] = []

    def enqueue_import(self, import_id: str) -> str:
        self.imports.append(import_id)
        return f"import-{import_id}"

    def enqueue_safety(self, upload_id: str) -> str:
        self.safety.append(upload_id)
        return f"safety-{upload_id}"

    def enqueue_job(self, job_id: str) -> str:
        return job_id

    def revoke(self, task_id: str) -> None:
        pass


class FakeClient:
    def download(
        self,
        url: str,
        workspace: Path,
        max_bytes: int,
        options: ImportOptions,
        on_progress: Callable[[int], None] | None = None,
    ) -> ImportedMedia:
        assert url.startswith("https://www.youtube.com/")
        assert options.media_type == "video"
        path = workspace / "source.mp4"
        if on_progress:
            on_progress(54)
        path.write_bytes(b"\x00\x00\x00\x18ftypisom-public-video")
        return ImportedMedia(
            path,
            "video/mp4",
            "imported-video.mp4",
            "My video",
            "Creator",
            "https://i.ytimg.com/cover.jpg",
        )


class FailingClient:
    def download(
        self,
        url: str,
        workspace: Path,
        max_bytes: int,
        options: ImportOptions,
        on_progress: Callable[[int], None] | None = None,
    ) -> ImportedMedia:
        raise ImportDownloadError("platform_auth_required")


def import_service(
    client: FakeClient | FailingClient | None = None,
) -> tuple[SocialImportService, FakeStorage, FakeQueue]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection: object, _: object) -> None:
        cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    storage = FakeStorage()
    queue = FakeQueue()
    service = SocialImportService(
        build_session_factory(engine),
        storage,
        queue,
        client or FakeClient(),
        Settings(environment="test"),
    )
    return service, storage, queue


@pytest.mark.parametrize(
    ("url", "provider"),
    [
        ("https://www.youtube.com/watch?v=abc", "youtube"),
        ("https://youtu.be/abc", "youtube"),
        ("https://www.instagram.com/reel/abc/", "instagram"),
        ("https://www.tiktok.com/@creator/video/123", "tiktok"),
        ("https://www.facebook.com/creator/videos/123", "facebook"),
        ("https://www.facebook.com/reel/123", "facebook"),
        ("https://fb.watch/abc/", "facebook"),
        ("https://vk.com/video-1_2", "vk"),
        ("https://vkvideo.ru/video-1_2", "vk"),
        ("https://rutube.ru/video/3eac3b4561676c17df9132a9a1e62e3e/", "rutube"),
        ("https://www.youtube.com/playlist?list=abc", "youtube"),
        ("https://www.youtube.com/@creator/live", "youtube"),
        ("https://www.instagram.com/creator/", "instagram"),
        ("https://www.tiktok.com/@creator", "tiktok"),
    ],
)
def test_platform_urls_are_classified_without_path_restrictions(url: str, provider: str) -> None:
    assert validate_social_url(url)[0] == provider


@pytest.mark.parametrize(
    "url",
    [
        "http://www.youtube.com/watch?v=abc",
        "https://youtube.com.evil.test/watch?v=abc",
        "https://user:password@youtube.com/watch?v=abc",
        "https://youtube.com:8443/watch?v=abc",
        "https://127.0.0.1/video",
    ],
)
def test_untrusted_or_private_destinations_are_rejected(url: str) -> None:
    with pytest.raises(HTTPException):
        validate_social_url(url)


def test_import_without_rights_attestation_enters_existing_safety_pipeline() -> None:
    service, storage, queue = import_service()
    item = service.create(ImportCreate(url="https://www.youtube.com/watch?v=abc"))
    assert item.status == ImportStatus.QUEUED
    assert item.progress == 0
    assert queue.imports == [item.id]
    completed = service.execute(item.id)
    assert completed.status == ImportStatus.COMPLETED
    assert completed.progress == 100
    assert completed.upload_id is not None
    assert completed.title == "My video"
    assert completed.creator == "Creator"
    assert queue.safety == [completed.upload_id]
    assert next(iter(storage.objects.values())).startswith(b"\x00\x00\x00\x18ftyp")


def test_import_contract_only_requires_a_platform_url() -> None:
    request = ImportCreate(url="https://youtu.be/abc")
    assert str(request.url) == "https://youtu.be/abc"
    assert request.media_type == "video"
    assert request.video_quality == "best"


@pytest.mark.parametrize(
    "url",
    [
        "https://www.tiktok.com/@creator/video/123",
        "https://www.facebook.com/reel/123",
        "https://vk.com/video-1_2",
        "https://rutube.ru/video/3eac3b4561676c17df9132a9a1e62e3e/",
    ],
)
def test_comment_import_rejects_platforms_without_public_comment_extraction(url: str) -> None:
    service, _, queue = import_service()
    with pytest.raises(HTTPException, match="comments_unsupported"):
        service.create(ImportCreate(url=url, media_type="comments"))
    assert queue.imports == []


def test_generic_audio_accepts_public_https_and_rejects_private_hosts() -> None:
    assert validate_public_url("https://audio.example/track")[0] == "generic"
    with pytest.raises(HTTPException):
        validate_public_url("https://127.0.0.1/track")


def test_playlist_count_zero_means_all() -> None:
    request = ImportCreate(
        url="https://www.youtube.com/playlist?list=abc",
        media_type="audio",
        playlist_count=0,
    )
    assert request.playlist_count == 0


def test_import_contract_rejects_an_invalid_time_range() -> None:
    with pytest.raises(ValueError, match="end_seconds"):
        ImportCreate(
            url="https://youtu.be/abc",
            start_seconds=30,
            end_seconds=10,
        )


def test_youtube_single_video_url_removes_playlist_radio_parameters() -> None:
    assert (
        _single_video_url(
            "https://www.youtube.com/watch?v=abc&list=playlist&index=2&start_radio=1&t=15"
        )
        == "https://www.youtube.com/watch?v=abc&t=15"
    )
    assert _single_video_url("https://www.instagram.com/reel/abc/?list=keep") == (
        "https://www.instagram.com/reel/abc/?list=keep"
    )


def test_bounded_video_quality_falls_back_for_single_format_platforms() -> None:
    assert _video_format("480").endswith("/best[ext=mp4]/best")
    assert _video_format("best").endswith("/best[ext=mp4]/best")
    assert _video_format("best").count("/best[ext=mp4]/best") == 1


def test_downloader_enables_node_and_format_fallbacks_for_public_youtube(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setattr(
        downloader_module.shutil,
        "which",
        lambda runtime: "/usr/local/bin/node" if runtime == "node" else None,
    )

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            captured.update(options)

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, str]:
            assert url == "https://www.youtube.com/watch?v=abc"
            assert download is True
            (tmp_path / "source.mp4").write_bytes(b"\x00\x00\x00\x18ftypisom-public-video")
            return {"title": "Video", "uploader": "Creator"}

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    result = YtDlpClient().download(
        "https://www.youtube.com/watch?v=abc&list=playlist&index=2",
        tmp_path,
        1024 * 1024,
    )

    assert result.path.name == "source.mp4"
    assert captured["noplaylist"] is True
    assert captured["retries"] == 5
    assert captured["extractor_retries"] == 5
    assert "extractor_args" not in captured
    assert captured["js_runtimes"] == {"node": {"path": "/usr/local/bin/node"}}
    assert captured["remote_components"] == ["ejs:github"]
    assert captured["format"] == (
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/"
        "bestvideo[ext=webm]+bestaudio[ext=webm]/"
        "bestvideo+bestaudio/best[ext=mp4]/best"
    )
    assert captured["postprocessors"] == [{"key": "FFmpegVideoRemuxer", "preferedformat": "mp4"}]


def test_downloader_fetches_selected_manual_or_automatic_subtitles(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            captured.update(options)

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, str]:
            (tmp_path / "source.ru.vtt").write_bytes(b"WEBVTT\n\n00:00.000 --> 00:01.000\nPrivet")
            return {"title": "Podcast", "uploader": "Creator"}

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    result = YtDlpClient().download(
        "https://www.youtube.com/watch?v=abc",
        tmp_path,
        1024 * 1024,
        ImportOptions(media_type="subtitles", subtitle_language="ru"),
    )

    assert result.content_type == "text/vtt"
    assert result.filename.endswith(".vtt")
    assert captured["skip_download"] is True
    assert captured["writesubtitles"] is True
    assert captured["writeautomaticsub"] is True
    assert captured["subtitleslangs"] == ["ru"]


def test_downloader_collects_public_comments_into_readable_text(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            captured.update(options)

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, object]:
            return {
                "title": "Public discussion",
                "uploader": "Creator",
                "extractor_key": "Youtube",
                "comments": [
                    {
                        "author": "Viewer One",
                        "text": "This changed my mind.",
                        "timestamp": 1_700_000_000,
                        "like_count": 12,
                        "parent": "root",
                    },
                    {
                        "author": "Viewer Two",
                        "text": "I disagree with the conclusion.",
                        "parent": "comment-1",
                    },
                ],
            }

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    result = YtDlpClient().download(
        "https://www.youtube.com/watch?v=abc",
        tmp_path,
        1024 * 1024,
        ImportOptions(media_type="comments"),
    )

    content = result.path.read_text(encoding="utf-8")
    assert result.content_type == "text/plain"
    assert result.filename.endswith(".txt")
    assert captured["skip_download"] is True
    assert captured["getcomments"] is True
    assert captured["extractor_args"] == {
        "youtube": {"comment_sort": ["top"], "max_comments": ["2500"]}
    }
    assert "Comments included in this file: 2" in content
    assert "Viewer One" in content
    assert "likes: 12" in content
    assert "I disagree with the conclusion." in content


def test_instagram_carousel_comments_are_deduplicated(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            pass

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, object]:
            comment = {"id": "same", "author": "Viewer", "text": "Shared discussion"}
            return {
                "title": "Carousel",
                "extractor_key": "Instagram",
                "entries": [{"comments": [comment]}, {"comments": [comment]}],
            }

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    result = YtDlpClient().download(
        "https://www.instagram.com/p/example/",
        tmp_path,
        1024 * 1024,
        ImportOptions(media_type="comments"),
    )
    content = result.path.read_text(encoding="utf-8")
    assert "Comments included in this file: 1" in content
    assert content.count("Shared discussion") == 1


def test_comment_result_never_selects_the_private_cookie_copy(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    cookie_source = tmp_path / "server-cookies.txt"
    cookie_source.write_text("private-cookie-secret", encoding="utf-8")
    workspace = tmp_path / "download"
    workspace.mkdir()

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            assert options["cookiefile"] == str(
                workspace / downloader_module.WORKING_COOKIES_FILENAME
            )

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, object]:
            return {
                "title": "Public discussion",
                "comments": [{"author": "Viewer", "text": "Public comment"}],
            }

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    result = YtDlpClient(cookies_file=str(cookie_source)).download(
        "https://www.youtube.com/watch?v=abc",
        workspace,
        1024 * 1024,
        ImportOptions(media_type="comments"),
    )
    content = result.path.read_text(encoding="utf-8")
    assert result.path.name == "comments.txt"
    assert "Public comment" in content
    assert "private-cookie-secret" not in content


def test_downloader_reports_when_platform_returns_no_comments(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            pass

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, object]:
            return {"title": "No discussion", "comments": []}

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    with pytest.raises(ImportDownloadError, match="comments_not_found"):
        YtDlpClient().download(
            "https://www.youtube.com/watch?v=abc",
            tmp_path,
            1024 * 1024,
            ImportOptions(media_type="comments"),
        )


def test_downloader_applies_audio_quality_trim_and_playlist_item(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setattr(downloader_module.shutil, "which", lambda _: None)

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            captured.update(options)

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, str]:
            assert url == "https://www.youtube.com/playlist?list=abc"
            (tmp_path / "source.mp3").write_bytes(b"ID3safe-audio")
            return {"title": "Track", "uploader": "Creator"}

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    result = YtDlpClient().download(
        "https://www.youtube.com/playlist?list=abc",
        tmp_path,
        1024 * 1024,
        ImportOptions(
            media_type="audio",
            audio_bitrate_kbps=320,
            start_seconds=12.5,
            end_seconds=34,
            playlist_item=3,
        ),
    )

    assert result.content_type == "audio/mpeg"
    assert result.filename == "Track Converted.mp3"
    assert captured["format"] == "bestaudio/best"
    assert captured["noplaylist"] is False
    assert captured["playlist_items"] == "3"
    assert captured["force_keyframes_at_cuts"] is True
    assert list(captured["download_ranges"]({}, None)) == [  # type: ignore[operator]
        {"start_time": 12.5, "end_time": 34}
    ]
    assert captured["postprocessors"] == [
        {
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "320",
        }
    ]


def test_non_youtube_import_does_not_force_youtube_runtime(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            captured.update(options)

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, str]:
            assert url == "https://www.instagram.com/reel/abc/"
            assert download is True
            (tmp_path / "source.mp4").write_bytes(b"\x00\x00\x00\x18ftypisom-public-video")
            return {"title": "Video"}

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    YtDlpClient().download("https://www.instagram.com/reel/abc/", tmp_path, 1024 * 1024)

    assert "extractor_args" not in captured
    assert "js_runtimes" not in captured


def test_meta_import_retries_with_browser_impersonation(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    attempts: list[dict[str, object]] = []

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            attempts.append(options)

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, str]:
            if len(attempts) == 1:
                (tmp_path / "source.part").write_bytes(b"partial")
                raise downloader_module.DownloadError("Cannot parse data")
            assert not (tmp_path / "source.part").exists()
            (tmp_path / "source.mp4").write_bytes(b"\x00\x00\x00\x18ftypisom-public-video")
            return {"title": "Video"}

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    YtDlpClient().download(
        "https://www.facebook.com/reel/123",
        tmp_path,
        1024 * 1024,
    )

    assert len(attempts) == 2
    assert attempts[1]["impersonate"] == downloader_module.ImpersonateTarget.from_str("chrome")


def test_youtube_uses_internal_pot_provider_when_configured(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            captured.update(options)

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, str]:
            (tmp_path / "source.mp4").write_bytes(b"\x00\x00\x00\x18ftypisom-public-video")
            return {"title": "Video"}

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    YtDlpClient(pot_provider_url="http://pot-provider:4416/").download(
        "https://www.youtube.com/watch?v=abc",
        tmp_path,
        1024 * 1024,
    )

    assert captured["extractor_args"] == {
        "youtube": {
            "player_client": ["mweb"],
            "fetch_pot": ["always"],
        },
        "youtubepot-bgutilhttp": {
            "base_url": ["http://pot-provider:4416"],
        },
    }


def test_youtube_retries_with_safari_hls_client(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    attempts: list[dict[str, object]] = []

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            attempts.append(options)

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, str]:
            if len(attempts) == 1:
                (tmp_path / "source.part").write_bytes(b"partial")
                raise downloader_module.DownloadError("primary client failed")
            assert not (tmp_path / "source.part").exists()
            (tmp_path / "source.mp4").write_bytes(b"\x00\x00\x00\x18ftypisom-public-video")
            return {"title": "Video"}

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    YtDlpClient(pot_provider_url="http://pot-provider:4416").download(
        "https://www.youtube.com/watch?v=abc",
        tmp_path,
        1024 * 1024,
    )

    assert len(attempts) == 2
    assert attempts[1]["extractor_args"] == {"youtube": {"player_client": ["web_safari"]}}
    assert attempts[1]["impersonate"] == downloader_module.ImpersonateTarget.from_str("safari")


def test_youtube_tries_embedded_client_after_safari_failure(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    attempts: list[dict[str, object]] = []

    def fake_youtube_dl(options: dict[str, object]) -> MagicMock:
        attempts.append(options)
        instance = MagicMock()
        instance.__enter__.return_value = instance

        def extract_info(url: str, download: bool) -> dict[str, str]:
            if len(attempts) < 3:
                (tmp_path / "source.part").write_bytes(b"partial")
                raise downloader_module.DownloadError("client failed")
            assert not (tmp_path / "source.part").exists()
            (tmp_path / "source.mp4").write_bytes(b"\x00\x00\x00\x18ftypisom-public-video")
            return {"title": "Video"}

        instance.extract_info.side_effect = extract_info
        return instance

    monkeypatch.setattr(downloader_module, "YoutubeDL", fake_youtube_dl)
    YtDlpClient(pot_provider_url="http://pot-provider:4416").download(
        "https://www.youtube.com/watch?v=abc",
        tmp_path,
        1024 * 1024,
    )

    assert len(attempts) == 3
    assert attempts[2]["extractor_args"] == {"youtube": {"player_client": ["web_embedded"]}}


def test_cookie_secret_is_copied_to_a_private_writable_job_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    secret = tmp_path.parent / "read-only-cookies.txt"
    secret.write_text("# Netscape HTTP Cookie File\n", encoding="utf-8")
    secret.chmod(0o400)
    attempts: list[dict[str, object]] = []

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            attempts.append(options)

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, str]:
            if len(attempts) == 1:
                (tmp_path / "source.part").write_bytes(b"partial")
                raise downloader_module.DownloadError("primary client failed")
            cookiefile = Path(str(attempts[-1]["cookiefile"]))
            assert cookiefile.is_file()
            assert cookiefile.name == downloader_module.WORKING_COOKIES_FILENAME
            (tmp_path / "source.mp4").write_bytes(b"\x00\x00\x00\x18ftypisom-public-video")
            return {"title": "Video"}

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    YtDlpClient(cookies_file=str(secret)).download(
        "https://www.facebook.com/reel/123",
        tmp_path,
        1024 * 1024,
    )

    working = tmp_path / downloader_module.WORKING_COOKIES_FILENAME
    assert working.read_text(encoding="utf-8") == secret.read_text(encoding="utf-8")
    if os.name != "nt":
        assert working.stat().st_mode & 0o777 == 0o600
        assert secret.stat().st_mode & 0o777 == 0o400


def test_downloader_passes_configured_egress_proxy(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}

    class FakeYoutubeDL:
        def __init__(self, options: dict[str, object]) -> None:
            captured.update(options)

        def __enter__(self) -> "FakeYoutubeDL":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def extract_info(self, url: str, download: bool) -> dict[str, str]:
            (tmp_path / "source.mp4").write_bytes(b"\x00\x00\x00\x18ftypisom-public-video")
            return {"title": "Video"}

    monkeypatch.setattr(downloader_module, "YoutubeDL", FakeYoutubeDL)
    YtDlpClient(proxy_url="socks5://proxy.internal:1080").download(
        "https://www.youtube.com/watch?v=abc",
        tmp_path,
        1024 * 1024,
    )

    assert captured["proxy"] == "socks5://proxy.internal:1080"


@pytest.mark.parametrize(
    ("message", "code"),
    [
        (
            "Sign in to confirm you're not a bot. Use cookies for the authentication.",
            "platform_auth_required",
        ),
        (
            "Your IP address is blocked from accessing this post",
            "platform_ip_blocked",
        ),
        (
            "Instagram sent an empty media response. Use cookies for the authentication.",
            "platform_auth_required",
        ),
        ("HTTP Error 429: Too Many Requests", "platform_rate_limited"),
        ("Cannot parse data; please report this issue", "extractor_outdated"),
        ("Video unavailable", "media_unavailable"),
        ("Requested format is not available", "supported_format_unavailable"),
        ("File is larger than max-filesize", "media_too_large"),
        ("Network failure", "import_failed"),
    ],
)
def test_download_failures_are_classified(message: str, code: str) -> None:
    assert _download_error_code(message) == code


def test_youtube_preserves_verification_error_across_fallback_attempts() -> None:
    assert (
        _best_download_error_code(
            [
                "Sign in to confirm you're not a bot",
                "Requested format is not available",
                "Network failure",
            ]
        )
        == "platform_auth_required"
    )


def test_platform_auth_failure_is_preserved_for_the_frontend() -> None:
    service, _, _ = import_service(FailingClient())
    item = service.create(ImportCreate(url="https://www.youtube.com/watch?v=abc"))

    with pytest.raises(ImportDownloadError):
        service.execute(item.id)

    failed = service.get(item.id)
    assert failed.status == ImportStatus.FAILED
    assert failed.error_code == "platform_auth_required"

from collections.abc import Sequence
from pathlib import Path

import pytest

from fileflow_api.media.handlers import FfmpegHandler
from fileflow_api.media.registry import MEDIA_OPERATIONS, register_media_operations
from fileflow_api.workers.contracts import OperationRegistry, WorkRequest


class RecordingRunner:
    def __init__(self) -> None:
        self.commands: list[list[str]] = []

    def run(self, argv: Sequence[str], workspace: Path) -> None:
        command = list(argv)
        self.commands.append(command)
        output = Path(command[-1])
        output_format = command[command.index("-f") + 1]
        signatures = {
            "mp4": b"\x00\x00\x00\x18ftypisom",
            "mp3": b"ID3safe-audio",
            "wav": b"RIFF\x00\x00\x00\x00WAVE",
        }
        output.write_bytes(signatures[output_format] + b"result")


def request(tmp_path: Path, parameters: dict[str, str | int] | None = None) -> WorkRequest:
    source = tmp_path / "source"
    source.write_bytes(b"source")
    return WorkRequest(
        input_path=source,
        input_paths=(source,),
        output_path=tmp_path / "result",
        parameters=parameters or {},
        report_progress=lambda _: None,
    )


def test_video_compression_uses_bounded_server_owned_ffmpeg_arguments(tmp_path: Path) -> None:
    runner = RecordingRunner()
    result = FfmpegHandler("/usr/bin/ffmpeg", runner, "compress-video").execute(
        request(tmp_path, {"quality": 25, "preset": "slow", "max_height": 720})
    )
    command = runner.commands[0]
    assert result.content_type == "video/mp4"
    assert command[0] == "/usr/bin/ffmpeg"
    assert "-nostdin" in command
    assert command[command.index("-crf") + 1] == "25"
    assert command[command.index("-vf") + 1] == "scale=-2:min(ih\\,720)"
    assert command[command.index("-preset") + 1] == "slow"
    assert "-map_metadata" in command


@pytest.mark.parametrize(
    ("operation", "parameters", "content_type", "output_format"),
    [
        ("extract-audio", {"bitrate_kbps": 128}, "audio/mpeg", "mp3"),
        ("audio-to-mp3", {}, "audio/mpeg", "mp3"),
        ("audio-to-wav", {}, "audio/wav", "wav"),
        ("trim-audio", {"start_ms": 500, "duration_ms": 1500}, "audio/mpeg", "mp3"),
    ],
)
def test_audio_operations_have_explicit_output_contracts(
    tmp_path: Path,
    operation: str,
    parameters: dict[str, int],
    content_type: str,
    output_format: str,
) -> None:
    runner = RecordingRunner()
    result = FfmpegHandler("/usr/bin/ffmpeg", runner, operation).execute(
        request(tmp_path, parameters)
    )
    command = runner.commands[0]
    assert result.content_type == content_type
    assert command[command.index("-f") + 1] == output_format
    assert "-vn" in command


@pytest.mark.parametrize(
    "parameters",
    [
        {"quality": 2},
        {"quality": "23; rm -rf /"},
        {"preset": "$(whoami)"},
        {"max_height": 4320},
    ],
)
def test_untrusted_video_parameters_cannot_become_arguments(
    tmp_path: Path, parameters: dict[str, str | int]
) -> None:
    runner = RecordingRunner()
    with pytest.raises(ValueError, match="invalid"):
        FfmpegHandler("/usr/bin/ffmpeg", runner, "compress-video").execute(
            request(tmp_path, parameters)
        )
    assert runner.commands == []


def test_media_registry_exposes_only_reviewed_operations() -> None:
    registry = OperationRegistry()
    runner = RecordingRunner()
    register_media_operations(registry, "/usr/bin/ffmpeg", runner)
    assert all(registry.resolve(operation) is not None for operation in MEDIA_OPERATIONS)
    assert registry.resolve("client-provided-command") is None

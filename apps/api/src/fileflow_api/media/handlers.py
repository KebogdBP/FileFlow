from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Protocol

from fileflow_api.workers.contracts import Parameter, WorkRequest, WorkResult


class CommandRunner(Protocol):
    def run(self, argv: Sequence[str], workspace: Path) -> None: ...


def integer_parameter(
    parameters: Mapping[str, Parameter], name: str, default: int, allowed: range | set[int]
) -> int:
    value = parameters.get(name, default)
    if type(value) is not int or value not in allowed:
        raise ValueError(f"invalid {name}")
    return value


def choice_parameter(
    parameters: Mapping[str, Parameter], name: str, default: str, allowed: set[str]
) -> str:
    value = parameters.get(name, default)
    if not isinstance(value, str) or value not in allowed:
        raise ValueError(f"invalid {name}")
    return value


def reject_unknown(parameters: Mapping[str, Parameter], allowed: set[str]) -> None:
    unknown = set(parameters) - allowed
    if unknown:
        raise ValueError(f"invalid parameters: {','.join(sorted(unknown))}")


class FfmpegHandler:
    def __init__(self, ffmpeg_path: str, runner: CommandRunner, operation: str) -> None:
        if not Path(ffmpeg_path).is_absolute():
            raise ValueError("ffmpeg path must be absolute")
        self._ffmpeg = ffmpeg_path
        self._runner = runner
        self._operation = operation

    def accepts(self, content_type: str) -> bool:
        if self._operation in {
            "compress-video",
            "video-to-mp4",
            "resize-video",
            "extract-audio",
        }:
            return content_type.startswith("video/")
        return content_type.startswith("audio/")

    def execute(self, request: WorkRequest) -> WorkResult:
        argv, content_type = self._command(request)
        request.report_progress(10)
        self._runner.run(argv, request.output_path.parent)
        self._validate_signature(request.output_path, content_type)
        request.report_progress(95)
        return WorkResult(content_type=content_type)

    def _command(self, request: WorkRequest) -> tuple[list[str], str]:
        common = [
            self._ffmpeg,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(request.input_path),
            "-map_metadata",
            "-1",
        ]
        output = str(request.output_path)
        parameters = request.parameters
        if self._operation in {"compress-video", "video-to-mp4", "resize-video"}:
            reject_unknown(parameters, {"quality", "preset", "max_height"})
            crf = integer_parameter(parameters, "quality", 23, range(18, 33))
            preset = choice_parameter(parameters, "preset", "medium", {"fast", "medium", "slow"})
            height = integer_parameter(parameters, "max_height", 1080, {480, 720, 1080})
            return (
                [
                    *common,
                    "-map",
                    "0:v:0",
                    "-map",
                    "0:a?",
                    "-vf",
                    f"scale=-2:min(ih\\,{height})",
                    "-c:v",
                    "libx264",
                    "-preset",
                    preset,
                    "-crf",
                    str(crf),
                    "-pix_fmt",
                    "yuv420p",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "160k",
                    "-movflags",
                    "+faststart",
                    "-f",
                    "mp4",
                    output,
                ],
                "video/mp4",
            )
        if self._operation in {"extract-audio", "audio-to-mp3", "optimize-audio"}:
            reject_unknown(parameters, {"bitrate_kbps"})
            bitrate = integer_parameter(parameters, "bitrate_kbps", 192, {128, 192, 256})
            return (
                [
                    *common,
                    "-vn",
                    "-c:a",
                    "libmp3lame",
                    "-b:a",
                    f"{bitrate}k",
                    "-f",
                    "mp3",
                    output,
                ],
                "audio/mpeg",
            )
        if self._operation == "audio-to-wav":
            reject_unknown(parameters, set())
            return (
                [*common, "-vn", "-c:a", "pcm_s16le", "-f", "wav", output],
                "audio/wav",
            )
        if self._operation == "trim-audio":
            reject_unknown(parameters, {"start_ms", "duration_ms"})
            start_ms = integer_parameter(parameters, "start_ms", 0, range(0, 86_400_001))
            duration_ms = integer_parameter(
                parameters, "duration_ms", 30_000, range(100, 86_400_001)
            )
            return (
                [
                    *common,
                    "-ss",
                    f"{start_ms / 1000:.3f}",
                    "-t",
                    f"{duration_ms / 1000:.3f}",
                    "-vn",
                    "-c:a",
                    "libmp3lame",
                    "-b:a",
                    "192k",
                    "-f",
                    "mp3",
                    output,
                ],
                "audio/mpeg",
            )
        raise ValueError(f"unsupported media operation: {self._operation}")

    @staticmethod
    def _validate_signature(path: Path, content_type: str) -> None:
        with path.open("rb") as output:
            header = output.read(12)
        valid = {
            "video/mp4": len(header) >= 8 and header[4:8] == b"ftyp",
            "audio/mpeg": header.startswith(b"ID3")
            or header.startswith((b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")),
            "audio/wav": header.startswith(b"RIFF") and header[8:12] == b"WAVE",
        }
        if not valid.get(content_type, False):
            raise ValueError("ffmpeg returned an unexpected output signature")

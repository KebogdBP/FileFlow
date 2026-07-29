from fileflow_api.media.handlers import CommandRunner, FfmpegHandler
from fileflow_api.workers.contracts import OperationRegistry

MEDIA_OPERATIONS = (
    "compress-video",
    "video-to-mp4",
    "remove-video-metadata",
    "extract-audio",
    "audio-to-mp3",
    "audio-to-wav",
    "optimize-audio",
    "trim-audio",
)


def register_media_operations(
    registry: OperationRegistry, ffmpeg_path: str, runner: CommandRunner
) -> None:
    for operation in MEDIA_OPERATIONS:
        registry.register(operation, FfmpegHandler(ffmpeg_path, runner, operation))

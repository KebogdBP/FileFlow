# media-worker

The media worker registers validated FFmpeg operations on the shared processing consumer.

Runtime images must provide FFmpeg with `libx264`, AAC and `libmp3lame`, expose it through the absolute `FILEFLOW_FFMPEG_PATH`, run as an unprivileged user and keep outbound networking disabled.

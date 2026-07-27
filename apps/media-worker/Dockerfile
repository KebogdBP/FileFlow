FROM node:22-bookworm-slim AS javascript-runtime

FROM python:3.14-slim-bookworm

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ffmpeg ghostscript libreoffice-writer poppler-utils qpdf \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 fileflow

WORKDIR /app
COPY apps/api /app/apps/api
RUN python -m pip install --no-cache-dir /app/apps/api
COPY --from=javascript-runtime /usr/local/bin/node /usr/local/bin/node
RUN node --version \
    && ffmpeg -version | head -n 1 \
    && python -c "import importlib.metadata as m; import yt_dlp_ejs; assert m.version('bgutil-ytdlp-pot-provider') == '1.3.1'"

USER fileflow
WORKDIR /app/apps/api
ENV FILEFLOW_FFMPEG_PATH=/usr/bin/ffmpeg \
    FILEFLOW_FFPROBE_PATH=/usr/bin/ffprobe \
    FILEFLOW_LIBREOFFICE_PATH=/usr/bin/libreoffice \
    FILEFLOW_QPDF_PATH=/usr/bin/qpdf \
    FILEFLOW_GHOSTSCRIPT_PATH=/usr/bin/gs \
    FILEFLOW_PDFTOPPM_PATH=/usr/bin/pdftoppm \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

CMD ["celery", "-A", "fileflow_api.jobs.worker:celery_app", "worker", "--queues", "processing,imports", "--loglevel", "INFO"]

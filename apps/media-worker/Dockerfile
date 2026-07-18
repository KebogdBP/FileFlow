FROM python:3.14-slim-bookworm

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 fileflow

WORKDIR /app
COPY apps/api /app/apps/api
RUN python -m pip install --no-cache-dir /app/apps/api

USER fileflow
WORKDIR /app/apps/api
ENV FILEFLOW_FFMPEG_PATH=/usr/bin/ffmpeg \
    FILEFLOW_FFPROBE_PATH=/usr/bin/ffprobe \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

CMD ["celery", "-A", "fileflow_api.jobs.worker:celery_app", "worker", "--queues", "processing", "--loglevel", "INFO"]

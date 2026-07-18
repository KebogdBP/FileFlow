# M11 — Storage and Upload Engine

M11 adds the server-side temporary upload boundary without starting content scanning or jobs.

## Delivered

- PostgreSQL metadata models and an Alembic baseline migration;
- S3-compatible multipart storage adapter for MinIO and AWS S3;
- create, presign-part, inspect, complete and abort API lifecycle;
- random private object keys that never expose the client filename;
- 2 GiB default upload quota, MIME-family allowlist and 10,000-part limit;
- one-hour retention metadata and presigned URLs bounded by that lifetime;
- persisted completed-part ETags for audit and downstream processing.

## Operations

Run migrations from `apps/api`:

```sh
../api/.venv/bin/alembic upgrade head
```

Configuration uses the `FILEFLOW_` prefix. Production must override database and S3 credentials. Object expiry enforcement should also be configured as an S3 lifecycle rule; `expires_at` is the application cleanup source of truth.

Content-type validation is only an admission rule. M12 is responsible for signature inspection, malware scanning and abuse controls before any processing job can consume an object.

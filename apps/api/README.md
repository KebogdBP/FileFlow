# FileFlow API

FastAPI foundation for FileFlow cloud services.

```bash
pnpm api:setup
pnpm api:dev
```

Endpoints:

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`
- `GET /docs` when `FILEFLOW_ENVIRONMENT=development`

## Upload storage

Apply the metadata migration from this directory with:

```sh
.venv/bin/alembic upgrade head
```

The upload API uses PostgreSQL and S3-compatible storage configured through `FILEFLOW_DATABASE_URL` and `FILEFLOW_S3_*` environment variables.

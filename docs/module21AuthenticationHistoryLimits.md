# M21 — Authentication, History and Limits

M21 adds optional private accounts for cloud processing. Local browser operations remain
account-free and are not recorded.

## Delivered slice

- email/password registration and login with normalized unique email addresses;
- memory-hard scrypt password hashes with per-account random salts;
- opaque bearer sessions stored only as SHA-256 hashes and revocable on sign-out;
- authenticated cloud job creation with ownership attached to every new job;
- account-scoped, newest-first cloud history with bounded pagination;
- a server-enforced free-plan daily cloud-job allowance and explicit UTC reset time;
- an `/account` UI for sign-in, registration, quota visibility and cloud history;
- a forward-only Alembic migration for accounts, sessions and job ownership.

## API

```text
POST   /api/v1/account/register
POST   /api/v1/account/login
DELETE /api/v1/account/session
GET    /api/v1/account/me
GET    /api/v1/account/history?limit=20&offset=0
GET    /api/v1/account/limits
```

Cloud `POST /api/v1/jobs` now requires `Authorization: Bearer <token>`. Read-only access to an
existing opaque job identifier is unchanged for compatibility with active result polling.

## Privacy and limits

History contains cloud job metadata, not local file activity. Raw session tokens are never stored
server-side. The free plan defaults to 10 cloud jobs per UTC day and is configurable with
`FILEFLOW_FREE_DAILY_CLOUD_JOBS`; sessions default to 30 days via
`FILEFLOW_ACCOUNT_SESSION_TTL_SECONDS`.

## Verification

Account tests cover registration, normalization, duplicate rejection, invalid credentials,
authenticated profile access, session revocation, protected history and limit responses. M21 is
complete when repository formatting, lint, typecheck, tests and build all pass.

# M10 — Backend API Foundation

## Цель

Создать типизированный, тестируемый и безопасный фундамент FastAPI для последующих storage, queue и
cloud-processing модулей.

## Результат

- installable `fileflow-api` Python package;
- FastAPI application factory;
- Pydantic Settings с `FILEFLOW_` environment prefix;
- versioned `/api/v1` routing;
- liveness и readiness endpoints;
- единый JSON error envelope;
- request ID validation/generation и response propagation;
- базовые security headers;
- explicit CORS allowlist без credentials;
- production docs/OpenAPI disable;
- Ruff formatting/lint, strict MyPy и Pytest;
- Python checks встроены в общие pnpm quality commands и GitHub Actions.

## Endpoints

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

Readiness в M10 подтверждает готовность application/configuration layer. PostgreSQL, Redis и object
storage checks добавляются в M11 вместе с соответствующими dependencies.

## Definition of Done

- [x] app создаётся через testable factory;
- [x] settings валидируются Pydantic;
- [x] health contracts стабильны и versioned;
- [x] errors и request IDs имеют общий contract;
- [x] production docs отключены;
- [x] Python quality checks являются частью CI;
- [x] tests, lint, typecheck, build и format:check проходят.

## Следующий модуль

```text
M11 — Storage and Upload Engine
```

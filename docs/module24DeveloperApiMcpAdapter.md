# M24 — Developer API and MCP Adapter

## Цель

Открыть существующий безопасный processing flow программным клиентам и AI-агентам, не создавая
параллельный обход accounts, quotas, upload safety или job ownership.

## Developer API

После входа пользователь создаёт ключ один раз:

```http
POST /api/v1/account/api-keys
Authorization: Bearer <account-session>
Content-Type: application/json

{"name":"Local MCP"}
```

Ответ содержит `ff_live_...` только при создании. В базе хранится SHA-256 hash, а list endpoint
возвращает только безопасный prefix и metadata. Ключ принимается существующим Bearer auth:

```http
POST /api/v1/jobs
Authorization: Bearer ff_live_...
```

Доступны list и revoke через `/api/v1/account/api-keys`. Использование ключа обновляет
`last_used_at`; отозванный ключ сразу перестаёт проходить authentication. Job read/cancel теперь
обязательно проверяют владельца и возвращают 404 для чужого job ID.

## MCP adapter

Stdio-сервер запускается поверх того же API:

```bash
FILEFLOW_API_KEY=ff_live_... \
FILEFLOW_API_URL=https://api.fileflow.app \
pnpm api:mcp
```

Он публикует четыре bounded tool:

- `fileflow_get_limits`;
- `fileflow_create_job` для уже загруженного и safety-cleared upload;
- `fileflow_get_job`;
- `fileflow_cancel_job`.

MCP adapter не читает database/storage напрямую, не возвращает credential в tool results и
передаёт все действия в versioned REST API. Ошибки API возвращаются как `isError` tool result,
чтобы agent мог обработать их без падения transport.

## Security boundary

- API key наследует account quota и ownership;
- raw key показывается один раз и не логируется адаптером;
- MCP не получает инструмент для arbitrary URL fetch или filesystem traversal;
- загрузка и safety scan остаются обязательными до создания cloud job;
- ключ следует хранить в secret manager или process environment и отзывать при компрометации.

## Миграция

`20260719_11_developer_api_keys.py` добавляет revocable ключи с account foreign key, hash,
prefix, timestamps и индексами.

## Следующий этап

Последовательность M01–M24 завершена. Дальнейшие модули определяются после проверки beta usage и
developer feedback.

# M23 — Security, Compliance and Beta Launch

## Цель

Подготовить FileFlow к контролируемой закрытой beta: сделать production posture проверяемым,
опубликовать понятные правила обработки данных и зафиксировать безопасный launch process.

## Реализовано

- API возвращает CSP, HSTS в production, anti-framing, permissions, referrer, MIME и cache headers;
- allowlist trusted hosts закрывает Host-header attacks;
- `GET /api/v1/health/beta` fail-closed проверяет production environment, HTTPS origins,
  замену local storage secret и ограниченный host allowlist, не раскрывая значения настроек;
- опубликованы `/legal/privacy`, `/legal/terms` и `/legal/security`;
- responsible disclosure направляется на `security@fileflow.app`;
- legal navigation доступна с landing page.

## Закрытая beta: launch gate

Перед выдачей приглашений команда должна:

1. Настроить production database, Redis, private object storage и malware scanner.
2. Заменить storage credentials, разрешить только HTTPS origin и production hosts.
3. Получить `200` и `status: ready` от `/api/v1/health/beta`.
4. Проверить backup/restore metadata, automatic object cleanup и session revocation.
5. Настроить алерты на API error rate, queue depth, scan failures и cleanup failures.
6. Выполнить desktop/mobile smoke flow для local и cloud jobs.
7. Подтвердить incident owner, rollback owner и канал связи с beta users.

## Incident response

При подозрении на утечку или обход safety gate: остановить новые cloud jobs, отозвать активные
credentials и sessions, сохранить минимально необходимую диагностику, определить затронутые
объекты, удалить временные данные и сообщить пользователям о подтверждённом существенном влиянии.

## Граница модуля

Этот модуль предоставляет кодовые и процессные launch gates. Реальный production deploy,
юридическая проверка для выбранной юрисдикции и подключение внешнего alerting vendor остаются
операционными действиями владельца сервиса.

## Следующий модуль

M24 — Developer API and MCP Adapter — выполняется после подтверждения MVP.

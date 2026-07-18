# M08 — Local Processing Core

## Цель

Создать безопасный и переиспользуемый lifecycle для будущих операций, выполняемых в браузерном
worker, не добавляя конкретную конвертацию из M09.

## Результат

- новый пакет `@fileflow/local-processing`;
- typed request, progress, result, error и cancel contracts;
- capability detection для Worker, ArrayBuffer и device memory;
- conservative memory limits 64/128/256 MB;
- transferable ArrayBuffer transport;
- один active job на runner;
- monotonic progress clamping;
- cooperative cancellation contract;
- timeout, worker error и invalid-response normalization;
- deterministic listener cleanup и worker termination;
- reusable worker runtime с operation registry и AbortSignal;
- реальная browser-worker readiness check в `/workspace`;
- accessible progress, success и error feedback;
- unit tests полного lifecycle.

## Safety rules

- input проверяется до создания worker;
- oversized input отклоняется без выделения processing resources;
- concurrent operation получает `busy` error;
- cancel, timeout, result и error всегда освобождают worker;
- сообщения другого job id игнорируются;
- progress не может уменьшаться или выходить за `0..100`;
- unknown worker operations возвращают явную ошибку.

## Граница модуля

M08 не содержит image codec и не меняет пользовательский файл. Readiness operation передаёт только
8-byte buffer и проверяет transport/lifecycle. Первая полезная операция JPG/PNG → WebP относится к
M09.

## Definition of Done

- [x] worker transport и runtime типизированы;
- [x] memory/capability guards выполняются до worker start;
- [x] progress, cancel, timeout и errors нормализованы;
- [x] cleanup выполняется для каждого terminal state;
- [x] реальный worker scenario доступен в workspace;
- [x] reduced-motion и accessibility feedback поддержаны;
- [x] tests, lint, typecheck, build и format:check проходят.

## Следующий модуль

```text
M09 — Local Image Tools
```

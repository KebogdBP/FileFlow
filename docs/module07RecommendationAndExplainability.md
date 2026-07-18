# M07 — Recommendation and Explainability Engine

## Цель

Преобразовать результат безопасной инспекции в понятный outcome-first план, объяснив решение до
начала любой обработки.

## Результат

- reusable recommendation engine в `@fileflow/operation-registry`;
- operation definitions с устойчивыми identifiers и execution modes;
- рекомендации для image, video, audio, PDF и document;
- local/cloud mode выбирается детерминированно и отображается заранее;
- plain-language reason, expectation и privacy explanation;
- safe defaults с объяснением каждого значения;
- trade-offs и доступные alternatives;
- отдельные blocked и unsupported states;
- mismatch из M06 блокирует небезопасный plan;
- plan-only UI без запуска processing;
- responsive и accessible presentation;
- engine unit tests и workspace integration test.

## Правила решения

- image optimization выполняется local;
- video и document/PDF plans явно требуют protected cloud processing;
- audio до 250 MB получает local plan, более крупный audio — cloud plan;
- animated GIF не получает default, который потеряет animation;
- confidence `mismatch` всегда блокирует recommendation;
- unknown categories не получают выдуманный outcome.

## Граница модуля

M07 создаёт только декларативный operation plan. Он не кодирует, не конвертирует, не загружает файл
и не меняет source. Execution начинается в M08 и всегда требует отдельного подтверждения.

## Definition of Done

- [x] recommendations отделены от UI;
- [x] outcome, reason, expectation и trade-offs объяснены;
- [x] local/cloud mode и retention implications видимы;
- [x] safe defaults имеют rationale;
- [x] unsafe и unsupported states не создают plan;
- [x] plan не запускает processing;
- [x] mobile и accessibility foundation поддержаны;
- [x] tests, lint, typecheck, build и format:check проходят.

## Следующий модуль

```text
M08 — Local Processing Core
```

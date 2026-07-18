# M05 — File and URL Input

## Цель

Дать пользователю доступный и предсказуемый способ начать работу с одним локальным файлом или
публичной ссылкой, не запуская скрытую загрузку или обработку.

## Результат

- маршрут `/workspace`;
- drag-and-drop и native file picker;
- keyboard-accessible source tabs;
- file validation для image, video, audio, PDF и DOCX;
- лимит входного файла 2 GB;
- HTTPS URL validation для YouTube, Instagram и TikTok;
- защита от malformed, insecure и lookalike URLs;
- empty, drag-active, error и selected states;
- remove/reset action;
- `aria-live`, `role=alert`, labels и descriptions;
- явная privacy disclosure до следующего шага;
- responsive и reduced-motion alternatives;
- unit и markup contract tests.

## Граница модуля

M05 только принимает и валидирует источник. Он не читает metadata, не определяет содержимое, не
рекомендует операции, не загружает URL и не обрабатывает файл. Эти действия относятся к M06 и
последующим модулям.

## Definition of Done

- [x] picker и drag-and-drop принимают один файл;
- [x] file и URL validation возвращают понятные ошибки;
- [x] выбор источника не запускает upload;
- [x] local/cloud implications объясняются заранее;
- [x] empty, error и selected states реализованы;
- [x] keyboard, screen-reader и mobile foundations готовы;
- [x] tests, lint, typecheck, build и format:check проходят.

## Следующий модуль

```text
M06 — File Inspector
```

# M06 — File Inspector

## Цель

Безопасно объяснить, какой локальный файл выбрал пользователь, до рекомендаций, загрузки или
обработки.

## Результат

- локальное чтение только первых 32 bytes;
- определение image, video, audio, PDF и document category;
- signature detection для JPEG, PNG, GIF, WebP, PDF, WAV, Ogg, MP3 и ISO media;
- сравнение file header, extension и browser-provided MIME;
- verified, unverified, mismatch, loading и unreadable states;
- понятный metadata summary;
- защита от stale async inspection после reset или выбора другого файла;
- `aria-live`, `aria-busy` и текстовые status notices;
- responsive и reduced-motion UI;
- unit и integration tests.

## Privacy

Inspector использует `File.slice(0, 32)` и читает заголовок локально. Полный файл не читается, не
отправляется по сети и не обрабатывается. Browser-provided MIME не считается доказательством:
когда возможно, он сверяется с сигнатурой.

## Граница модуля

M06 не выбирает операцию и не обещает результат. Recommendation, explainability и выбор режима
выполнения относятся к M07.

## Definition of Done

- [x] category и безопасная metadata определяются локально;
- [x] сигнатура имеет приоритет над расширением и MIME;
- [x] mismatch и unreadable состояния объясняются пользователю;
- [x] неизвестная сигнатура обрабатывается без ложного утверждения;
- [x] async race после reset предотвращён;
- [x] mobile, accessibility и reduced motion поддержаны;
- [x] tests, lint, typecheck, build и format:check проходят.

## Следующий модуль

```text
M07 — Recommendation and Explainability Engine
```

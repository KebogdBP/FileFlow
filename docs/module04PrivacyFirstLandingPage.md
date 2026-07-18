# M04 — Privacy-first Landing Page

## Цель

Представить FileFlow как единое приватное файловое пространство и объяснить local/cloud модель до
начала работы с файлом.

## Результат

- privacy-first positioning и ясный hero;
- preview будущего workspace без преждевременной реализации file input из M05;
- явные local, cloud и automatic-cleanup promises;
- outcome-first обзор будущих инструментов;
- понятный четырёхшаговый пользовательский сценарий;
- responsive desktop, tablet и mobile layout;
- semantic landmarks, heading hierarchy и accessible navigation;
- reveal motion с полной reduced-motion альтернативой;
- SEO metadata и unit tests.

## Граница модуля

M04 не загружает и не обрабатывает файлы. Интерактивный drag-and-drop, file picker, URL input и
валидация относятся к M05 — File and URL Input. На landing page показан честно обозначенный
workspace preview.

## Definition of Done

- [x] positioning соответствует product vision;
- [x] local/cloud processing объяснён до начала операции;
- [x] отсутствие скрытых upload и temporary retention сформулированы явно;
- [x] landing page адаптивен;
- [x] motion использует M03 и поддерживает reduced motion;
- [x] accessibility и metadata добавлены;
- [x] tests, lint, typecheck, build и format:check проходят.

## Следующий модуль

```text
M05 — File and URL Input
```

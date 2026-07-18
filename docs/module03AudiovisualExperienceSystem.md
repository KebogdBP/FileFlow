# M03 — Audiovisual Experience System

## Цель

Создать переиспользуемый язык движения и обратной связи, который объясняет обработку файлов,
подчёркивает приватность и не мешает пользователям с чувствительностью к движению или звуку.

## Результат

После завершения M03 должны быть готовы:

- semantic motion tokens;
- reveal, state-change and progress motion;
- processing states: idle, analyzing, processing, completed, error;
- file transformation preview;
- waveform preview;
- progress ring integration;
- result and size-saving feedback;
- `aria-live` announcements;
- complete reduced-motion alternative;
- optional completion sound, disabled by default;
- responsive demo page;
- unit tests.

## Принципы

1. Motion объясняет изменение состояния, а не украшает экран.
2. Пользователь всегда видит, где выполняется операция: local или cloud.
3. Состояние не передаётся только цветом: используются текст, форма и иконка.
4. При `prefers-reduced-motion: reduce` движение отключается, информация сохраняется.
5. Звук выключен по умолчанию и включается только после явного согласия.

## Motion tokens

```text
instant   0ms
fast      140ms
base      220ms
slow      420ms
process   900ms

standard  cubic-bezier(0.2, 0, 0, 1)
enter     cubic-bezier(0, 0, 0.2, 1)
exit      cubic-bezier(0.4, 0, 1, 1)
```

## Компоненты

### ProcessingFeedback

- сообщает текущий этап через `aria-live`;
- показывает linear или circular progress;
- отображает local/cloud processing mode;
- поддерживает completed и error без зависимости только от цвета.

### FileTransformation

- показывает source и result;
- объясняет преобразование формата;
- отображает изменение размера и процент экономии.

### WaveformPreview

- даёт стабильный preview без случайного layout shift;
- имеет текстовое accessible name;
- анимация активности отключается при reduced motion.

### Completion sound

- выключен по умолчанию;
- запускается только после opt-in;
- короткий синтезированный тон, без сетевого аудиофайла.

## Demo

```text
http://localhost:3000/audiovisual-system
```

## Definition of Done

M03 завершён, если:

- motion tokens определены;
- processing states реализованы;
- transformation и waveform previews доступны;
- progress ring интегрирован;
- `aria-live` работает;
- reduced-motion полностью отключает декоративное движение;
- completion sound opt-in и disabled by default;
- mobile layout проверен;
- tests, lint, typecheck и build проходят;
- документация обновлена.

## Проверка завершения

- reveal, state-change и progress motion используют semantic tokens;
- reduced-motion отключает reveal, processing, progress и waveform animations;
- responsive layout переходит в одну колонку на ширине до `768px`;
- Web Audio completion tone создаётся только после opt-in и освобождает AudioContext;
- unit tests покрывают состояния, accessibility, motion contracts, mobile breakpoint и звук;
- `test`, `lint`, `typecheck`, `build` и `format:check` проходят.

## Следующий модуль

```text
M04 — Privacy-first Landing Page
```

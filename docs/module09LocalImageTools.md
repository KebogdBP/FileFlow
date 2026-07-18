# M09 — Local Image Tools

## Цель

Дать первый законченный product slice: выбрать JPG/PNG, безопасно распознать его, получить
объяснённую рекомендацию, локально создать WebP и скачать проверенный результат.

## Результат

- реальная JPG/PNG → WebP conversion в browser worker;
- quality control 40–100%;
- resize presets: original, 1920, 1280 и 800 px;
- aspect ratio и запрет ненужного upscaling;
- metadata removal через pixel re-encode;
- progress stages и cancellation через M08;
- capability/memory guard до чтения полного файла;
- WebP RIFF signature validation после worker result;
- source/result size comparison, включая отрицательную экономию;
- output dimensions и valid-result badge;
- download filename lifecycle;
- object URL revoke при новом результате и unmount;
- responsive, accessible и reduced-motion UI;
- unit, integration, type и production-build checks.

## Privacy

Source передаётся только в module Worker как transferable ArrayBuffer. Сетевые запросы не
выполняются. Canvas создаётся внутри worker, а re-encode не переносит EXIF/GPS metadata в WebP.

## Safety

- инструмент показывается только для JPEG/PNG с непротиворечивой сигнатурой;
- memory limit проверяется до `file.arrayBuffer()`;
- output нельзя скачать до RIFF/WEBP validation;
- увеличение размера показывается как отрицательная экономия, а не скрывается;
- cancel и unmount прекращают job и освобождают worker/object URL.

## Definition of Done

- [x] JPG/PNG → WebP работает полностью локально;
- [x] quality и resize controls доступны;
- [x] metadata удаляется re-encode процессом;
- [x] результат проверяется перед download;
- [x] размеры source/result сравниваются честно;
- [x] cancellation и cleanup реализованы;
- [x] tests, lint, typecheck, build и format:check проходят.

## Следующий модуль

```text
M10 — Backend API Foundation
```

# FileFlow — состояние проекта

> Последнее обновление: 12 августа 2026 года.
>
> Базовая production-версия на момент составления: `7717276` (`Add direct large media downloads`)

Этот документ — практическая точка входа для разработчика, который впервые открывает
репозиторий. Здесь зафиксировано, что уже работает, как устроен проект, где он запущен,
какие проблемы были исправлены и что следует делать дальше. Подробная история каждого
этапа M01–M24 находится в каталоге [`docs`](docs); продуктовая концепция — в
[`PROJECT_VISION_AND_EXECUTION.md`](PROJECT_VISION_AND_EXECUTION.md).

## 1. Краткий статус

FileFlow — privacy-first веб-приложение для локальной и облачной обработки файлов, а
также импорта медиа по ссылкам. MVP-модули M01–M24 реализованы. Публичная версия работает
на [fileflow.pro](https://fileflow.pro), backend доступен через `/api/v1` на том же домене
и через `api.fileflow.pro`.

Текущая стадия проекта: **работающий MVP / закрытая beta, сбор эксплуатационных данных**.
Основной функционал реализован и покрыт автоматическими тестами, но production пока
одноузловой, выкладка выполняется вручную, а устойчивость внешних загрузчиков зависит от
изменений платформ и сетевой репутации IP-адреса сервера.

Последняя завершённая работа:

- исправлена загрузка публичных видео ВКонтакте;
- добавлены два режима доставки медиа: проверенное облако и напрямую на устройство;
- лимит проверенного облачного импорта/загрузки увеличен с 512 МиБ до 2 ГиБ;
- прямое скачивание не имеет прикладного лимита FileFlow и не буферизует весь файл в
  памяти браузера;
- production обновлён и проверен реальной ссылкой VK в обоих режимах.

## 2. Архитектура

Репозиторий — pnpm/Turborepo monorepo.

| Область       | Технологии                                            | Где искать                            |
| ------------- | ----------------------------------------------------- | ------------------------------------- |
| Web           | Next.js 15, React 19, TypeScript, Vitest              | `apps/web`                            |
| API           | FastAPI, Pydantic, SQLAlchemy, Alembic                | `apps/api`                            |
| Очереди       | Celery + Redis                                        | `apps/api/src/fileflow_api/jobs`      |
| Обработка     | FFmpeg, LibreOffice, Poppler, Ghostscript, qpdf       | `apps/media-worker`, backend image    |
| Хранилище     | PostgreSQL + S3-совместимый MinIO                     | `compose.yaml`, `deploy/hetzner-test` |
| Safety        | ClamAV, проверка сигнатуры и карантин                 | `apps/api/src/fileflow_api/safety`    |
| Импорт URL    | yt-dlp, curl-cffi, Node/EJS, bgutil PO-token provider | `apps/api/src/fileflow_api/imports`   |
| Общие пакеты  | UI, contracts, types, processing, registry            | `packages/*`                          |
| Reverse proxy | Caddy                                                 | `deploy/hetzner-test/Caddyfile`       |

Основной cloud-flow:

1. Клиент создаёт upload и передаёт файл в S3-совместимое временное хранилище.
2. API сохраняет метаданные в PostgreSQL.
3. Safety worker сверяет контейнер/сигнатуру и сканирует объект ClamAV.
4. После clean-verdict processing worker выполняет операцию.
5. Результат сохраняется во временное object storage и доступен пользователю.
6. Cleanup удаляет просроченные объекты.

Импорт по URL использует два разных flow:

- **Проверенное облако** — yt-dlp скачивает один результат, затем он проходит временное
  хранение, карантин и malware scan. Лимит результата — 2 ГиБ.
- **Напрямую на устройство** — API выдаёт короткоживущий HMAC-подписанный ticket,
  скачивает/объединяет медиа во временной директории и потоково передаёт его браузеру.
  Файл не попадает в MinIO и не сканируется ClamAV; временная директория удаляется после
  завершения ответа. Прикладного лимита нет, но остаются физический диск, сеть, timeout и
  лимиты источника.

## 3. Что реализовано

### Пользовательский интерфейс

- privacy-first landing page и явное объяснение local/cloud обработки;
- адаптивные desktop/mobile интерфейсы, light/dark/system themes;
- единый intent-based workspace для файлов и URL;
- инспекция типа файла по имени, MIME и magic bytes;
- рекомендации операций с объяснением результата и компромиссов;
- локальная обработка изображений и пакетная обработка с progress/cancel;
- каталог отдельных SEO-страниц инструментов;
- интерфейсы аккаунта, истории cloud jobs и API-ключей;
- локализация ключевых downloader-flow на русском, английском и испанском;
- first-party продуктовая аналитика без передачи исходных файлов.

### Файлы и медиа

Registry содержит операции для:

- оптимизации изображений и удаления metadata;
- video compression, video to MP4, удаления video metadata, извлечения аудио и субтитров;
- audio optimization, MP3/WAV conversion и trim;
- merge, quick edit, compress, split PDF;
- PDF to JPG/DOCX/PPTX и DOCX to PDF.

Лёгкие операции выполняются в браузере, тяжёлые — через изолированный cloud-worker.
Cloud jobs имеют устойчивый lifecycle, progress, cancellation, ownership и историю.

### Социальные платформы

Importer построен поверх pinned `yt-dlp` и принимает только HTTPS URL разрешённых
платформ с защитой от credentials, custom ports и lookalike-доменов. В коде предусмотрены
YouTube, Instagram, Facebook, TikTok, VK, RuTube и другие поддерживаемые extractor-ы из
актуального allowlist. Реальная доступность конкретного URL определяется самой платформой,
географией/IP сервера, cookies и состоянием upstream extractor-а.

Поддерживаются:

- видео `best`, 1080p, 720p и 480p;
- MP3 128/192/320 kbps;
- диапазон start/end;
- один выбранный элемент playlist;
- субтитры выбранного языка;
- выгрузка комментариев и AI-анализ результатов;
- cloud и direct-to-device delivery.

YouTube на VPS использует приватный bgutil Proof-of-Origin provider. При необходимости
можно подключить read-only cookies-файл и egress proxy через серверные переменные. Секреты
не должны попадать в Git.

### Аккаунты, API и AI

- приватные аккаунты и отзываемые сессии;
- владение upload/job/import и облачная история;
- серверный дневной лимит бесплатных cloud jobs;
- отзываемые developer API keys;
- bounded stdio MCP adapter поверх FileFlow API;
- AI-provider abstraction с конфигурацией DeepSeek/Gemini;
- AI-функции для субтитров и анализа комментариев.

### Безопасность и эксплуатация

- exact-host/SSRF guards для URL imports;
- quarantine до clean-verdict, fail-closed ошибки безопасности;
- ограниченные очереди и один worker каждого класса в текущем VPS profile;
- security headers, trusted hosts, CORS allowlist и legal/beta pages;
- временное хранение и периодическая очистка;
- health endpoints `/api/v1/health/live` и `/api/v1/health/beta`;
- CI на push в `main` и pull requests.

## 4. Исправленные проблемы

Ниже перечислены значимые исправления последних итераций. Полная история находится в
`git log`.

- **VK video download:** устранён общий сбой импорта публичных VK-видео; production smoke
  test вернул корректный MP4 как напрямую, так и через облачный pipeline.
- **Лимит 512 МиБ:** cloud limit поднят до 2 ГиБ во frontend/backend/worker/ClamAV config;
  для прямой выдачи FileFlow ceiling удалён.
- **Память браузера:** cloud/direct download запускается как native browser download и не
  создаёт JavaScript `Blob` размером со весь результат.
- **Потоковая выдача:** Caddy отключает proxy buffering для direct route; API отдаёт файл
  блоками по 1 МиБ с `Content-Length`, `Content-Disposition` и `no-store`.
- **Очистка direct-файлов:** временная директория удаляется в `finally`, в том числе после
  закрытия/обрыва stream.
- **Классификация больших результатов:** превышение cloud ceiling возвращает стабильную
  ошибку `media_too_large`, а не неопределённый `import_failed`.
- **Комментарии платформ:** исключены platform credentials из результатов, исправлен
  публичный импорт комментариев и добавлен community-response analysis.
- **YouTube:** добавлены fallback-стратегии verification, Node/EJS runtime и приватный
  PO-token provider; cookies/proxy остаются эксплуатационными fallback-ами.
- **Субтитры:** импорт ограничен выбранным языком, добавлен extraction/AI workspace.
- **Конвертеры:** исправлено сохранение состояния при sign-in, legacy PDF quality,
  PowerPoint export, имена скачиваемых файлов и мобильные downloader controls.

## 5. Production

Текущий профиль описан в [`deploy/hetzner-test`](deploy/hetzner-test):

- OVHcloud VPS, Ubuntu 24.04;
- 4 vCPU, 8 ГБ RAM, 75 ГБ NVMe;
- Docker Compose: Caddy, API, PostgreSQL, Redis, MinIO, ClamAV, bgutil provider,
  safety/processing workers и object cleanup;
- Caddy — единственный публичный ingress; базы и внутренние сервисы не публикуют порты;
- checked-cloud limit — 2 ГиБ;
- direct download — без FileFlow ceiling, но ограничен свободным временным диском;
- retention — 1 час, cleanup — каждые 10 минут для объектов старше 75 минут;
- бесплатный лимит — 10 cloud jobs на аккаунт в день.

Выкладка сейчас ручная:

```bash
git pull --ff-only
NEXT_PUBLIC_API_URL=https://fileflow.pro/api/v1 \
NEXT_PUBLIC_SITE_URL=https://fileflow.pro pnpm build
cd deploy/hetzner-test
docker compose up -d --build
docker compose ps
curl https://fileflow.pro/api/v1/health/live
curl https://fileflow.pro/api/v1/health/beta
```

Перед обновлением production обязательно делать `pg_dump`. Серверный `.env`, cookies,
proxy credentials и AI keys не хранятся в репозитории.

Важно: это single-node beta deployment без off-site backup и без автоматического
rollback. Его нельзя считать отказоустойчивой production-инфраструктурой.

## 6. Тесты и качество

Стандартный набор проверок:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build:all
```

GitHub Actions выполняет эти команды на Ubuntu с Node 22 и Python 3.12. На момент
последней функции direct download отдельно были успешно выполнены:

- 60 backend import tests;
- 140 остальных backend tests;
- 59 web tests;
- Ruff, ESLint, TypeScript, Prettier и Next production build.

Известная особенность локальной Windows-разработки: `apps/api/tests/test_workers.py`
использует Unix-модуль Python `resource` и не собирается на Windows. Полный backend suite
следует запускать в Linux/WSL/Docker или доверять Linux CI. Это не regression direct
download.

## 7. Что ещё нужно сделать

### P0 — надёжность production

- настроить автоматический deploy после успешного CI с health check и rollback;
- вынести резервные копии PostgreSQL и критичных конфигураций за пределы VPS, регулярно
  проверять восстановление;
- добавить мониторинг uptime, queue depth, disk/RAM, import success rate, cleanup failures
  и оповещения;
- ввести disk-space admission control для direct downloads, чтобы большой параллельный
  импорт не заполнил NVMe;
- провести нагрузочные тесты 2-ГиБ cloud flow и нескольких одновременных direct streams;
- документировать и репетировать disaster recovery/secret rotation.

### P1 — стабильность продукта

- создать регулярные smoke tests по платформам YouTube, Instagram, TikTok, VK и RuTube с
  разрешёнными тестовыми URL; показывать platform health в операционной панели;
- отслеживать releases/regressions yt-dlp и иметь безопасную процедуру срочного обновления;
- улучшить понятные пользовательские ошибки для auth-required, geo-block, deleted/private,
  live/playlist и upstream rate limit;
- проверить основные операции на реальных больших файлах и на Safari/iOS/Android;
- расширить end-to-end тесты аккаунта, upload → scan → process → download и cancellation;
- определить политику rate limiting direct endpoints и предел одновременных streams.

### P2 — развитие после beta

- анализировать first-party метрики и обратную связь до расширения набора инструментов;
- принять решение о тарифах, квотах и масштабировании object storage/workers;
- улучшить доступность и локализацию оставшихся экранов;
- рассмотреть OCR, structured PDF/Markdown, team workspaces, integrations и workflow builder
  только после подтверждения спроса;
- актуализировать продуктовый roadmap: исходный M01–M24 завершён и не должен использоваться
  как текущий backlog.

## 8. Известные ограничения и риски

- Внешние платформы меняют HTML/API/anti-bot правила без предупреждения. Успех yt-dlp
  нельзя гарантировать для каждого URL даже при исправном FileFlow.
- Direct mode намеренно не проходит malware scan. UI и документация должны продолжать явно
  сообщать об этом пользователю.
- «Без лимита» означает отсутствие прикладного лимита FileFlow, а не бесконечный ресурс:
  действуют свободный диск VPS, bandwidth, timeout и ограничения источника/браузера.
- Cloud scan файлов до 2 ГиБ ресурсоёмок на 8-ГиБ сервере; нужна нагрузочная валидация и
  наблюдаемость до массового трафика.
- Single-node MinIO/PostgreSQL создают единую точку отказа.
- Cookies платформы — чувствительный эксплуатационный секрет; их нельзя логировать,
  коммитить или включать в image.
- Скрипты package.json используют Unix path к Python venv; native Windows workflow имеет
  ограничения. Предпочтительны WSL/Linux/Docker.

## 9. Быстрый старт нового разработчика

Требования: Node.js 22+, pnpm, Python 3.12+, Docker Compose. Для media/document операций
проще использовать готовые контейнеры, где уже есть FFmpeg и document utilities.

```bash
git clone https://github.com/KebogdBP/FileFlow.git
cd FileFlow
pnpm install --frozen-lockfile
python3 -m venv apps/api/.venv
apps/api/.venv/bin/python -m pip install -e './apps/api[dev]'
cp .env.example .env
docker compose --profile backend up --build
```

В другом терминале:

```bash
pnpm dev
```

Полезные адреса:

- `http://localhost:3000` — landing;
- `http://localhost:3000/workspace` — основной workspace;
- `http://localhost:3000/account` — аккаунт и cloud history;
- `http://localhost:3000/tools` — каталог инструментов;
- `http://localhost:8000/api/v1/health/live` — API health.

Перед первой задачей прочитайте:

1. `README.md` — команды и базовая структура.
2. Этот документ — фактический текущий статус.
3. `PROJECT_VISION_AND_EXECUTION.md` — продуктовые принципы и исторический roadmap.
4. Соответствующий `docs/moduleXX*.md` — контракт конкретного модуля.
5. `deploy/hetzner-test/README.md` — только если задача касается production.

## 10. Правила внесения изменений

- Не коммитьте `.env`, cookies, SSH keys, proxy credentials и API keys.
- Не обходите quarantine/safety gate в cloud-flow.
- При добавлении операции обновляйте operation registry, API/worker contract, UI, tests и
  соответствующую документацию вместе.
- Для importer-изменений проверяйте SSRF/host validation, bounded output, cleanup и stable
  error code.
- Не полагайтесь только на unit tests для платформ: нужен production-like smoke test с
  разрешённым публичным URL.
- Перед production deploy: backup → pull/build → compose up → health checks → smoke test →
  logs.
- Обновляйте `Project_Progress.md`, когда меняется архитектура, production status,
  существенный backlog или известные риски.

## 11. Definition of done

Изменение считается завершённым, когда:

1. Реализован и документирован пользовательский/системный контракт.
2. Есть тесты для happy path, ошибок, security boundaries и cleanup.
3. Проходят format, lint, typecheck, tests и production build.
4. Для инфраструктурной функции проверены health/logs и rollback path.
5. Для платформенного importer-а выполнен smoke test допустимым реальным URL.
6. Не добавлены секреты или персональные данные.
7. Обновлены этот статус-документ и профильная документация, если изменилась фактическая
   картина проекта.

---

Коротко: FileFlow уже является работающим beta-продуктом, а не прототипом. Следующий
правильный фокус — наблюдаемость, восстановление, автоматизация deploy, platform smoke tests
и проверка поведения под нагрузкой; расширять feature scope следует только по данным beta.

# FileFlow

Privacy-first file workspace built as a pnpm/Turborepo monorepo with Next.js, React and
TypeScript.

For the current implementation status, production notes, known limitations, prioritized
backlog and developer onboarding, see [`Project_Progress.md`](Project_Progress.md).

The current foundation includes:

- M01 — repository and development environment;
- M02 — design system;
- M03 — audiovisual experience system;
- M04 — privacy-first landing page.
- M05 — accessible file and URL input.
- M06 — local file inspector.
- M07 — recommendation and explainability engine.
- M08 — guarded browser-worker processing core.
- M09 — local JPG/PNG to WebP image tools.
- M10 — FastAPI backend foundation.
- M11–M18 — secure storage, safety, orchestration and media/document workers.
- M19 — unified intent-based workspace.
- M20 — verified local image batches with grouped progress and cancellation.
- M21 — private accounts, authenticated cloud history and daily plan limits.
- M22 — registry-driven intent SEO and bounded first-party product analytics.
- M23 — production security posture, legal pages and closed-beta launch gates.
- M24 — revocable developer API keys and a bounded stdio MCP adapter.

## Development

```bash
pnpm install
pnpm dev
```

### Run the complete cloud workflow

Start PostgreSQL, Redis, MinIO, ClamAV, the API and all workers:

```bash
docker compose --profile backend up --build
```

In another terminal, start the web application:

```bash
pnpm dev
```

Open `http://localhost:3000/account`, create a free account, then use
`http://localhost:3000/workspace`. Cloud files are uploaded through the FileFlow API,
scanned by the safety worker, processed by the media/document worker and returned as a
downloadable result. Select 2–20 PDF files together to use Merge PDF.

Routes:

- landing page: `http://localhost:3000`;
- design system: `http://localhost:3000/design-system`;
- audiovisual system: `http://localhost:3000/audiovisual-system`.
- workspace input: `http://localhost:3000/workspace`.
- account and cloud history: `http://localhost:3000/account`.
- intent tool directory: `http://localhost:3000/tools`.
- API health: `http://localhost:8000/api/v1/health/live`.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The planned module sequence through post-MVP M24 is complete.

## MCP adapter

Create a developer key from `/api/v1/account/api-keys`, then run:

```bash
FILEFLOW_API_KEY=ff_live_... FILEFLOW_API_URL=http://localhost:8000 pnpm api:mcp
```

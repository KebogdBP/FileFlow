# M01 — Repository and Development Environment

## Goal

Create a reproducible monorepo foundation for FileFlow frontend, backend, workers, and shared packages.

## Decisions

- pnpm workspaces
- Turborepo
- Next.js App Router
- TypeScript strict mode
- Node.js 22+
- backend and worker apps are placeholders in M01

## Install

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

## Verify

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Definition of Done

- web app starts locally;
- shared UI package is imported by web;
- root quality commands work;
- CI runs formatting, linting, type checks, tests, and build;
- backend infrastructure is optional and not required to start M01;
- no conversion logic is implemented yet.

## Next

M02 — Design System.

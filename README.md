# FileFlow

Privacy-first file workspace built as a pnpm/Turborepo monorepo with Next.js, React and
TypeScript.

The current foundation includes:

- M01 — repository and development environment;
- M02 — design system;
- M03 — audiovisual experience system;
- M04 — privacy-first landing page.
- M05 — accessible file and URL input.
- M06 — local file inspector.
- M07 — recommendation and explainability engine.

## Development

```bash
pnpm install
pnpm dev
```

Routes:

- landing page: `http://localhost:3000`;
- design system: `http://localhost:3000/design-system`;
- audiovisual system: `http://localhost:3000/audiovisual-system`.
- workspace input: `http://localhost:3000/workspace`.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The next product module is M08 — Local Processing Core.

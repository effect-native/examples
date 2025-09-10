# Repository Guidelines

## Project Structure & Module Organization
- Root: PNPM workspace (`pnpm-workspace.yaml`), TypeScript + Vitest.
- Packages: `packages/*` (e.g., `packages/create-effect-app`). Source in `src/`, build to `dist/`.
- Examples: `examples/*` (e.g., `examples/http-server`). Not part of the workspace; manage deps per example.
- Templates & Scripts: `templates/*`, `scripts/*`; CLI shim in `bin/`.

## Build, Test, and Development Commands
- Install: `pnpm install` (root workspace only).
- Type check: `pnpm check` (runs TS project references across packages).
- Lint: `pnpm lint` (ESLint + dprint rules). Fix: `pnpm lint-fix`.
- Build: `pnpm build` (builds all workspace packages in parallel).
- Test (workspace): `pnpm vitest`.
- Test one package: `pnpm vitest --root packages/create-effect-app`.
- Run an example: `cd examples/http-server && pnpm install && pnpm dev` (or `pnpm test`).

## Coding Style & Naming Conventions
- Language: TypeScript (ESM). Indent 2 spaces; max line 120.
- Quotes: double; semicolons: ASI; trailing commas: never.
- Imports: prefer explicit type imports; avoid unused vars (prefix `_` if intentional).
- Lint/format is enforced via ESLint (`eslint.config.mjs`) with `@effect/dprint`.

## Testing Guidelines
- Framework: Vitest. Unit tests live under `test/**/*.test.ts`.
- Workspace config: `vitest.workspace.ts`; shared defaults in `vitest.shared.ts`.
- Keep tests fast/deterministic; mock external IO. Aim for green in <10 minutes CI.

## Commit & Pull Request Guidelines
- Small, focused PRs. Describe the change, rationale, and acceptance examples.
- Link related issues. Include screenshots/CLI output when relevant.
- For package changes, add a changeset: `pnpm changeset` (CI handles versioning/publish).
- Pre-push: `pnpm lint && pnpm check && pnpm vitest`.

## Agent Workflow (uXP)
- Work in thin slices: pair → TDD (red→green→refactor) → integrate.
- Guardrails: 5‑minute build, sustainable pace, collective ownership.
- After each change: ensure tests pass, clarify code, remove duplication, and simplify.

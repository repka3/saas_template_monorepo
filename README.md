# SaaS Template Monorepo

This repo is a lean SaaS starter, not a full platform. The supported baseline is intentionally small:

- one Express backend
- one React dashboard
- one Astro landing app
- Better Auth for authentication flows
- Prisma + PostgreSQL for persistence
- same-origin dashboard and avatar delivery by default

The goal is to keep the repo explicit and extendable without wrapping the core stack in a large custom framework.

## Supported Baseline

### Apps

- `apps/backend`
  Express 5, Better Auth, Prisma, Zod validation, policy-based authorization, structured logging, and standard route rate limiting.
- `apps/dashboard`
  Vite + React 19 dashboard with guest/shared/user/superadmin route sections, lazy-loaded page entrypoints, and routed error boundaries.
- `apps/landing`
  Astro landing app for public marketing pages.

### Packages

- `packages/contracts`
  Shared auth roles and API contracts.
- `packages/eslint-config`
  Shared ESLint config.
- `packages/typescript-config`
  Shared TypeScript config.

## Architecture Conventions

### Backend

- Controllers stay thin.
- Services own Better Auth and Prisma orchestration.
- Authorization policies live under `apps/backend/src/utils/authorization`.
- Multi-step service mutations should use explicit orchestration with compensation only where rollback is safe.
- Better Auth handles `/api/auth/*`; normal API routes use `express-rate-limit`.

### Dashboard

- `App.tsx` is top-level route composition only.
- Auth pages live outside `App.tsx`.
- Routes are grouped by guest, shared, user, and superadmin sections.
- Non-root pages are lazy-loaded by default.
- Error boundaries protect both the whole app and routed user/superadmin sections.

## Quality Guardrails

CI now enforces the baseline verification set:

- `pnpm lint`
- `pnpm check-types`
- `pnpm --filter backend test`
- `pnpm --filter dashboard test`
- `pnpm build`

See [.github/workflows/ci.yml](./.github/workflows/ci.yml).

## Local Setup

1. Install dependencies.

```sh
pnpm install
```

2. Create env files.

```sh
cp apps/backend/.env.example apps/backend/.env
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/landing/.env.example apps/landing/.env
```

3. Start PostgreSQL.

```sh
docker compose -f docker-compose.localhost.yml up -d
```

4. Run Prisma and generate the client.

```sh
pnpm --filter backend prisma:migrate
pnpm --filter backend prisma:generate
```

5. Seed the bootstrap superadmin.

```sh
pnpm --filter backend seed:superadmin
```

6. Start the workspace.

```sh
pnpm dev
```

Defaults:

- backend: `http://localhost:3005`
- landing: `http://localhost:4321`
- dashboard: `http://localhost:5173`

## Deployment

Production Docker baselines are included for:

- `apps/backend/Dockerfile`
- `apps/dashboard/Dockerfile`
- `apps/landing/Dockerfile`

The supported deployment contract is documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

## Deferred On Purpose

These are intentionally outside the starter baseline for this pass:

- Stripe or billing integration
- Redis-backed rate limiting
- multi-instance upload storage
- product-specific marketplace or organization systems beyond the current auth/role baseline

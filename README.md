# SaaS Project Monorepo

This repo is the base I use for my own SaaS projects.

For the last 10 years I kept rebuilding the same plumbing over and over:
authentication, route protection, dashboard shells, role handling, email flows,
backend wiring, and the usual project scaffolding. This
repository is my attempt to keep that work in one place and evolve it in public.

It is opinionated on purpose. A lot of choices here reflect personal taste:
route structure, dashboard layout, naming, boundaries between apps, and the
kind of baseline I like to start from. Contributions are welcome, but this is
not meant to be an enterprise-grade, one-size-fits-all scaffolding kit.

## Purpose

The goal is to have a reusable starting point for building a SaaS product with:

- a backend API
- authentication and session handling
- role-aware protected routes
- a dashboard app
- shared config packages
- a monorepo setup that is easy to iterate on

## What is currently in the repo

### Apps

- `apps/backend`
  - Express 5 API
  - Better Auth mounted on `/api/auth/*`
  - Prisma + PostgreSQL
  - email/password auth
  - email verification and password reset via SMTP
  - env-driven bootstrap superadmin seed
  - example protected and public routes

- `apps/dashboard`
  - Vite + React 19 app
  - public auth routes: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
  - protected areas for `USER` and `SUPERADMIN`
  - role-aware redirects after authentication
  - dashboard layout baseline and app-local `shadcn/ui` components

### Packages

- `packages/eslint-config`
  - shared ESLint config

- `packages/typescript-config`
  - shared TypeScript config

### Tooling

- Turborepo
- pnpm workspaces
- Prisma
- Vitest on the backend

## What is not here yet

- A proper marketing / landing website built with Astro

Right now `/` lives inside the React dashboard app as a temporary entry point.
The plan is to add a separate Astro landing page later, and keep the dashboard
focused on the authenticated product area.

## Scope and expectations

This repo is public because I think the baseline can still be useful to other
people, especially solo builders and small teams.

That said:

- this is primarily my SaaS project foundation
- it is intentionally opinionated
- it may change in ways that fit my workflow first
- it is useful as a reference or starting point, not as a promise of enterprise-ready abstractions

If you want to contribute, that is welcome. Just keep in mind the project is
curated more like a personal product base than a neutral framework.

## Workspace layout

```text
apps/
  backend/    Express + Better Auth + Prisma
  dashboard/  Vite + React dashboard

packages/
  eslint-config/      shared lint config
  typescript-config/  shared TS config
```

## Local setup

1. Install dependencies.

```sh
pnpm install
```

2. Create local env files.

```sh
cp apps/backend/.env.example apps/backend/.env
cp apps/dashboard/.env.example apps/dashboard/.env
```

3. Start PostgreSQL.

```sh
docker compose -f docker-compose.localhost.yml up -d
```

4. Run the Prisma migration and generate the client.

```sh
pnpm --filter backend prisma:migrate
pnpm --filter backend prisma:generate
```

5. Seed the bootstrap superadmin.

```sh
pnpm --filter backend seed:superadmin
```

6. Start the apps.

```sh
pnpm dev
```

Defaults:

- backend: `http://localhost:3005`
- dashboard: `http://localhost:5173`

## Mail setup

The backend expects SMTP settings in `apps/backend/.env`.

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

The example values target a local SMTP catcher such as Mailpit or MailHog on
port `1025`.

## Seed behavior

`pnpm --filter backend seed:superadmin` ensures the env-driven superadmin
exists, activates that account, synchronizes its password, and demotes any
other `SUPERADMIN` rows back to `USER`.

## Useful commands

```sh
pnpm dev
pnpm build
pnpm lint
pnpm check-types
pnpm --filter backend test
pnpm --filter backend dev
pnpm --filter dashboard dev
```

# Reusable SaaS Auth Template

This monorepo is a copyable Better Auth template built around a generic
email/password flow, role-aware routing, and SMTP-backed email delivery.

## Included baseline flow

- Public routes: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- Protected routes: `/dashboard` for standard users and `/superadmin` for the seeded bootstrap superadmin
- Public registration always creates a `USER`
- A single env-driven superadmin can be bootstrapped with `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD`
- Better Auth remains mounted at `/api/auth/*`
- Prisma + PostgreSQL back the auth data

## Workspace layout

- `apps/backend`: Express API, Better Auth config, Prisma schema, SMTP mailer, seed script
- `apps/dashboard`: Vite + React auth shell using the Better Auth client directly

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

6. Start the backend and dashboard.

```sh
pnpm dev
```

The backend defaults to `http://localhost:3005` and the dashboard defaults to
`http://localhost:5173`.

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
pnpm --filter backend dev
pnpm --filter dashboard dev
pnpm --filter backend check-types
pnpm --filter backend build
pnpm --filter dashboard build
```

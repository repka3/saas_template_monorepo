# Production Deployment Contract

This document defines the requirements and responsibilities for running this SaaS template in production.

## Required environment variables

### Backend (`apps/backend`)

All of the following must be set. The app refuses to start without them.

| Variable | Description |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Port the Express server listens on |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | At least 32 characters, cryptographically random |
| `BETTER_AUTH_URL` | Public base URL of the backend (e.g. `https://api.example.com`) |
| `CORS_ORIGIN` | Allowed origin for CORS (e.g. `https://app.example.com`) |
| `TRUST_PROXY` | `false` or a positive integer hop count |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Outbound email configuration |
| `LOG_LEVEL` | One of `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `UPLOADS_DIR` | Directory for user-uploaded files (default `.tmp/uploads`) |
| `MAX_AVATAR_UPLOAD_BYTES` | Max avatar upload size (default `2097152`) |

Optional: `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME` for seeding an initial admin. `AUTH_SIGNUP_MODE` defaults to `public`.

### Dashboard (`apps/dashboard`)

Build-time variable, must be set **before** `vite build`:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Public backend URL (e.g. `https://api.example.com`). Required in production; the build fails without it. |

### Landing (`apps/landing`)

Build-time variable, must be set **before** `astro build`:

| Variable | Description |
|---|---|
| `PUBLIC_DASHBOARD_URL` | Public dashboard URL (e.g. `https://app.example.com`). Required in production; the build fails without it. |

## Routing assumptions

The backend serves three kinds of HTTP traffic under a single Express listener:

| Path prefix | Purpose |
|---|---|
| `/api/auth/*` | Better Auth session and authentication endpoints |
| `/api/*` | Custom API routes (health, users, etc.) |
| `/uploads/avatars/*` | Static avatar files from the configured `UPLOADS_DIR` |

### Proxy / CDN responsibilities

In production, a reverse proxy or CDN sits in front of the backend and should:

1. **Terminate TLS** so the backend receives plain HTTP.
2. **Set `X-Forwarded-For`** and **`X-Forwarded-Proto`** headers. Configure `TRUST_PROXY` to match the expected hop count.
3. **Set or forward `X-Request-Id`** for request tracing.
4. **Restrict upload size** at the proxy level as a defense-in-depth measure (the app enforces `MAX_AVATAR_UPLOAD_BYTES` internally).
5. **Serve static assets** for the dashboard and landing builds directly, without hitting the backend.
6. **Do not cache `/api/*`** responses unless you explicitly want to. Auth sessions are cookie-based and user-specific.

## Browser headers

The backend uses `helmet` to set security headers. The proxy should not strip these:

- `Strict-Transport-Security` (set by helmet; add TLS configuration at the proxy level as well)
- `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` (all set by helmet)
- CORS is configured via the `CORS_ORIGIN` environment variable with `credentials: include`

## Health checks

| Endpoint | Purpose | Response |
|---|---|---|
| `GET /api/ping` | Liveness (is the process up?) | `200 { "status": "ok" }` |
| `GET /api/health` | Readiness (can it serve traffic?) | `200 { "status": "ok", "database": "connected" }` or `503 { "status": "degraded", "database": "unreachable" }` |

Load balancers should use `/api/health` for readiness probes.

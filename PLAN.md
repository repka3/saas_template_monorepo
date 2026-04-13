# Template Plan

## Bottom line

This repo is already a strong starter.

It is not overwhelmed by dozens of structural problems. It is down to five concrete template-bar issues. Everything else is secondary.

If a task does not clearly improve one of the five items below, it is probably scope creep.

## What actually matters

### 1. Validate avatar uploads by file contents

Problem:

- `apps/backend/src/middleware/upload-avatar.ts` trusts client MIME type and extension mapping

Why it matters:

- this is below the bar for a template claiming secure defaults

Done when:

- uploaded files are checked server-side by signature / magic bytes
- non-image files disguised as images are rejected

### 2. Fail fast on missing frontend public env

Problem:

- `apps/dashboard/src/lib/api-client.ts` falls back to `http://localhost:3005`
- `apps/dashboard/src/lib/auth-client.ts` falls back to `http://localhost:3005`
- `apps/landing/src/pages/index.astro` falls back to `http://localhost:5173`

Why it matters:

- a reusable template should not silently point production builds at localhost

Done when:

- required public env is validated for production
- localhost defaults are limited to explicit dev-only paths, or removed entirely

### 3. Make `/health` a real readiness check

Problem:

- `apps/backend/src/controllers/publicHealthControllers.ts` returns `{ status: 'ok' }` for both `/ping` and `/health`

Why it matters:

- deployers cannot tell whether the app is actually usable

Done when:

- `/ping` stays a simple liveness check
- `/health` or `/ready` verifies database connectivity at minimum

### 4. Remove dummy auth routes from normal runtime

Problem:

- `apps/backend/src/app.ts` mounts `dummyPrivateRouter` in all environments
- this exposes `/api/dummy-private` and `/api/dummy-superadmin`

Why it matters:

- these are test/demo fixtures, not real template surface area

Done when:

- the routes are removed, or
- they are mounted only in dev/test

### 5. Write a short production deployment contract

Problem:

- the repo does not clearly define browser headers, env requirements, or proxy/CDN responsibilities for production

Why it matters:

- the frontend apps are static surfaces, so some security behavior lives in infra, not only app code

Done when:

- there is a short root-level document covering:
- required public env
- expected browser headers
- same-origin/static/upload routing assumptions
- proxy or CDN responsibilities

## Priority order

Do these in order:

1. avatar validation
2. fail-fast frontend env validation
3. real readiness check
4. remove or gate dummy routes
5. short production deployment contract

## Not blockers

These came up, but they should not block calling this a solid template once the five items above are done:

- CSRF middleware on custom routes: worth documenting if the deployment model broadens, but not the current main defect given Better Auth defaults and same-site assumptions
- production Dockerfile: useful, optional
- long provider-specific deployment guide: optional once the short deployment contract exists

## Release rule

After the five fixes above, this should be described as:

"Strong reusable SaaS starter with a small, explicit deployment contract."

Do not keep expanding the plan after that unless a newly found issue is clearly more serious than one of the current five.

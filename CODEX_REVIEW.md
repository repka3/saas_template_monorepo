# Monorepo Production Readiness Review

## Verdict

This repo is a good starter, but not yet a production-ready micro SaaS base for the scale described.

The current baseline is solid in a few important ways:

- the monorepo builds cleanly
- lint and typecheck pass
- the backend test baseline is reasonably strong
- env validation, shared contracts, and API error shaping are already in place

But there are still a few structural issues that should be fixed before building out a real product on top of it.

## What Was Verified

The following checks were run successfully:

- `pnpm build`
- `pnpm lint`
- `pnpm check-types`
- `pnpm --filter backend test`
- `pnpm --filter dashboard test`

## Findings

### 1. Avatar assets are not safe across separate frontend/backend origins

Severity: High

The backend stores user images as root-relative paths like `/uploads/avatars/...`, and the dashboard preserves them as root-relative URLs.

That means the browser resolves them against the dashboard origin, not the backend/API origin. With the current split local setup (`5173` dashboard, `3005` backend), this is already fragile and will break unless both apps are served behind the same host.

Relevant files:

- `apps/backend/src/services/userServices.ts`
- `apps/dashboard/src/lib/api-client.ts`
- `apps/dashboard/src/features/profile/profile-display.ts`

### 2. Backend multi-step mutations are not atomic

Severity: High

The main user-management service performs multiple Better Auth mutations and Prisma mutations in sequence. If one step fails after earlier steps have already succeeded, the code logs a partial-success condition but does not reconcile state.

This is manageable for one admin flow, but once the backend grows to dozens of controllers and services, this pattern will become a real source of data drift and operational bugs.

Relevant file:

- `apps/backend/src/services/userServices.ts`

### 3. Rate limiting is process-local only

Severity: Medium

Rate limiting currently uses an in-memory `Map`.

That means:

- limits reset on process restart
- limits are inconsistent across multiple backend instances
- production behavior will differ from local single-process behavior

Relevant file:

- `apps/backend/src/middleware/rate-limit.ts`

### 4. A public debug endpoint should not ship as production surface

Severity: Medium

`/api/test_error_500` is publicly exposed and intentionally throws a server error. That is useful for development, but it should be removed or gated behind a development-only flag before treating the template as production-ready.

Relevant file:

- `apps/backend/src/routes/publicHealthRoutes.ts`

### 5. The dashboard is already accumulating too much responsibility in a few files

Severity: Medium

The current frontend works, but the shape does not scale cleanly yet:

- `src/App.tsx` already contains routing plus auth/page logic in one large file
- the superadmin pages are already large and state-heavy
- the production build already emits a large single dashboard bundle

This is exactly the sort of pattern that becomes painful once the dashboard grows to 40+ pages.

Relevant files:

- `apps/dashboard/src/App.tsx`
- `apps/dashboard/src/pages/superadmin/SuperadminUsersPage.tsx`
- `apps/dashboard/src/pages/superadmin/SuperadminUserDetailPage.tsx`
- `apps/dashboard/src/main.tsx`

### 6. Frontend test coverage is too thin for a reusable production base

Severity: Medium

The backend has a decent baseline of route/service tests. The dashboard does not. Frontend coverage is currently too small for the risky parts of the app:

- auth routing and redirects
- protected route behavior
- admin forms and mutation flows
- profile/avatar flows

Relevant file:

- `apps/dashboard/src/lib/api-client.test.ts`

### 7. CI/deployment guardrails are not present in the repo

Severity: Medium

There is no in-repo CI workflow or deployment baseline checked into the monorepo. The code quality checks exist, but the repo does not yet enforce them automatically.

That is not fatal for a starter, but it is missing from a production-ready base template.

## What Should Be Added First

Before building product-specific features, the template should be stabilized with the following base additions.

### A. Fix asset URL handling

- resolve backend-served assets against the API origin or a dedicated asset origin
- do not rely on root-relative paths resolving correctly from the dashboard origin

### B. Introduce a safer application-service pattern for multi-step backend flows

- separate orchestration use cases from raw data access
- make cross-system mutations explicit
- add compensation or follow-up reconciliation for partial failures
- avoid spreading the current sequential side-effect pattern across future services

### C. Replace in-memory rate limiting with a shared store

- use a Redis-backed or equivalent shared limiter
- make rate limiting consistent across instances and restarts

### D. Remove or gate debug-only API surface

- remove `/api/test_error_500`, or
- expose it only in development/test environments

### E. Restructure the dashboard before it gets larger

- split route definitions into route modules
- lazy-load route/page entrypoints
- move page-specific logic into feature components/hooks/forms
- keep `App.tsx` focused on routing and top-level composition only

### F. Add real frontend test coverage

Minimum useful additions:

- auth flow tests
- protected route tests
- superadmin list/detail flow tests
- profile update and avatar flow tests

### G. Add CI in the repo

At minimum, every change should automatically run:

- `pnpm lint`
- `pnpm check-types`
- `pnpm build`
- `pnpm --filter backend test`
- `pnpm --filter dashboard test`

## Final Assessment

If the question is "can I start extending this now and trust it to stay stable when the backend has 30 controllers and 30 services and the dashboard has 40 pages?", the answer is:

Not yet.

If the question is "is this a solid foundation that can become production-ready with a focused hardening pass first?", the answer is:

Yes.

The repo is already much better than a throwaway scaffold. It just still needs a short round of structural hardening before it becomes the right long-term base for a real product.

# Lean Starter Hardening Plan

## Summary

This repo is already a solid SaaS starter, but it still needs a short hardening pass before it becomes the right long-term base for a real product.

The goal of this plan is to improve what is already here, not turn the template into a full SaaS platform. The target baseline is:

- a lean monorepo starter
- a safe and scalable backend structure
- a dashboard that can grow past the current page count without turning into a maintenance problem
- in-repo quality and deployment guardrails

## What This Plan Optimizes For

- Keep the repo opinionated and practical.
- Preserve the current single-server, same-origin deployment contract.
- Fix structural issues that will slow down future work.
- Avoid baking in product-specific systems too early.

## Phase 1: Structural Hardening

### 1. Backend service orchestration

Refactor the current multi-step user-management flows into a clearer application-service pattern.

Concrete work:

- separate cross-system orchestration from raw Prisma access
- make Better Auth mutations and Prisma mutations explicit steps
- define a failure policy for partial success cases
- add compensation where rollback is safe
- add structured logging for unrecoverable partial-failure states

Initial focus:

- `apps/backend/src/services/userServices.ts`

Acceptance criteria:

- `createSuperadminUser` and `updateSuperadminUser` no longer hide multi-step cross-system writes inside one large sequential flow
- failure handling is explicit and test-covered
- future backend services have a clear pattern to copy

### 2. Authorization structure

Expand the current authorization utilities into a small policy layer that can scale beyond the current user/self checks.

Concrete work:

- keep authorization rules in `apps/backend/src/utils/authorization`
- define policy helpers around actor, target, and action
- migrate current user/superadmin access checks to the new pattern

Acceptance criteria:

- authorization logic is not spread ad hoc through controllers and services
- the current rules are centralized and test-covered

### 3. Remove debug-only production surface

The public test 500 route should not ship as normal production behavior.

Concrete work:

- remove `/api/test_error_500` entirely, or
- register it only in development and test environments

Acceptance criteria:

- production does not expose an intentional crash endpoint

## Phase 2: Dashboard Scalability

### 4. Split `App.tsx` into route modules and page modules

The dashboard currently keeps too much routing and page logic in one file.

Concrete work:

- keep `App.tsx` focused on top-level route composition
- move auth pages into their own files
- group routes by guest, shared, user, and superadmin sections
- move page-specific state and form logic closer to feature boundaries

Initial focus:

- `apps/dashboard/src/App.tsx`
- `apps/dashboard/src/pages/superadmin/SuperadminUsersPage.tsx`
- `apps/dashboard/src/pages/superadmin/SuperadminUserDetailPage.tsx`

Acceptance criteria:

- `App.tsx` becomes a small composition file
- auth pages are not defined inline
- large page files are decomposed into feature-level components and hooks

### 5. Lazy loading and route-level code splitting

The dashboard build already emits a large single JS bundle. Page entrypoints should be lazy-loaded before the app grows further.

Concrete work:

- lazy-load non-root page entrypoints with `React.lazy`
- wrap route sections with `Suspense` fallbacks
- keep loading states simple and consistent with the existing UI

Acceptance criteria:

- the dashboard no longer ships as one monolithic route bundle
- new pages follow the same lazy-loaded route pattern by default

### 6. Add React error boundaries

The current dashboard has no error boundary around routed UI.

Concrete work:

- add a top-level route error boundary
- add section-level boundaries for user and superadmin areas
- use a simple fallback UI that preserves navigation context where possible

Acceptance criteria:

- a render failure in one section does not blank the entire app
- the fallback state is test-covered

### 7. Improve frontend test coverage

The dashboard test baseline is too small for a reusable starter.

Concrete work:

- add auth routing and redirect tests
- add protected route tests
- add superadmin list/detail flow tests
- add profile/avatar flow tests
- add error-boundary rendering tests

Acceptance criteria:

- risky dashboard flows have direct test coverage
- frontend regressions are more likely to be caught before merge

## Phase 3: Delivery Guardrails

### 8. Replace the custom rate limiter with a standard layered setup

The current `Map`-based middleware should be removed. The starter should use the standard split between auth-route protection and normal Express-route protection.

Concrete work:

- rely on Better Auth built-in rate limiting for `/api/auth/*`
- replace the custom Express `Map` limiter with `express-rate-limit` for non-auth routes
- configure route-specific limits instead of one generic policy
- use IP-based limits for anonymous traffic and authenticated-user-based keys where appropriate
- configure Express proxy handling correctly for reverse-proxy deployments
- defer Redis-backed storage until the deployment becomes multi-instance or horizontally scaled
- when shared storage is needed, use a standard store such as `rate-limit-redis` rather than a homegrown abstraction

Acceptance criteria:

- the repo no longer ships a custom in-memory rate limiter implementation
- Better Auth handles auth endpoint throttling
- normal API routes use a standard, well-supported Express rate-limiting library
- the upgrade path to Redis is documented but not required for the default starter

### 9. CI in the repo

The repo already has good checks, but they are not enforced in CI.

Concrete work:

- add a GitHub Actions workflow that runs:
  - `pnpm lint`
  - `pnpm check-types`
  - `pnpm --filter backend test`
  - `pnpm --filter dashboard test`
  - `pnpm build`

Acceptance criteria:

- every pull request runs the same baseline checks automatically

### 10. Production deployment baseline

The repo should include a minimal production deployment shape that matches the current architecture.

Concrete work:

- add production Dockerfiles for `backend`, `dashboard`, and `landing`
- document the expected reverse-proxy setup
- keep `/uploads` same-origin with the dashboard
- document the current supported deployment contract clearly

Acceptance criteria:

- deployment expectations are explicit in-repo
- the documented production shape matches the current avatar/file contract

### 11. Documentation cleanup

The docs should clearly separate built-in baseline behavior from deferred extensions.

Concrete work:

- update `README.md` to reflect the supported starter baseline
- document what is intentionally deferred
- document the recommended architecture conventions introduced by this plan

Acceptance criteria:

- a new contributor can tell what the template supports out of the box
- future extensions have clear boundaries

## Explicitly Deferred

These items should not be treated as baseline requirements for this pass:

- Stripe or billing integration
- organizations or multi-tenancy
- background job infrastructure
- object storage abstraction for uploads
- full OpenAPI/Swagger generation
- a general development data seeding system beyond the bootstrap superadmin

These may be added later when a real product needs them.

## Notes From Review Consolidation

- Keep the current avatar path contract. Same-origin `/uploads` is valid for the documented deployment model.
- Do not add a new pagination system. The repo already has reusable pagination primitives; the real need is better page decomposition and reuse.
- Treat the dashboard structure and backend orchestration gaps as the highest-value work.

## Exit Criteria

This plan is complete when:

- backend cross-system mutations have an explicit, test-covered pattern
- dashboard routing is modular, lazy-loaded, and protected by error boundaries
- frontend coverage includes the main auth and admin flows
- CI runs the existing quality gates automatically
- the repo documents a supported production deployment baseline

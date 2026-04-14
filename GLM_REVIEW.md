# SaaS Template Monorepo — Architecture Review

## Context

Review of a pnpm + Turborepo monorepo (Express 5 backend, React 19 dashboard, Astro landing page) intended as a reusable SaaS starter template. The goal: assess whether this foundation will hold up when scaled to ~30 services and ~30 pages.

**Verdict: The foundation is solid. The code quality is above average.** There are no catastrophic issues. What follows are genuine concerns ranked from most to least impactful.

---

## What's Done Well

- **Clean service/controller/route layering** with Zod validation at every boundary
- **Service orchestration with compensation** (`service-orchestration.ts`) — rare to see in a template, well implemented
- **Centralized error handling** — custom `HttpError`, structured responses, no stack traces leaked
- **File upload security** — magic byte validation, UUID filenames, path traversal protection, size limits
- **Auth** — Better Auth with email verification, password reset, session revocation, ban system, role gating
- **Rate limiting** — tiered by role and operation type, IP + user ID fallback
- **TypeScript strict mode** + `noUncheckedIndexedAccess` across the repo
- **Structured logging** — pino with request IDs, correlation context
- **Lazy loading** on all dashboard routes
- **Shared contracts package** — API types are co-located and type-safe end-to-end

---

## Issues That Will Block Scaling

### 1. No Database Connection Pooling Configuration
**File**: `apps/backend/src/lib/prisma.ts`

`PrismaPg` adapter is created with only a `connectionString` — no `max`, `idle_timeout`, or pool size settings. Under load (or with 30 services hitting the same DB), you'll exhaust PostgreSQL connections.

**Fix**: Add pool configuration:
```ts
adapter: new PrismaPg({
  connectionString: env.DATABASE_URL,
  pool: { max: 10, idleTimeoutMillis: 30000 },
})
```
Or configure it via the `DATABASE_URL` query params (`?connection_limit=10&pool_timeout=30`).



### 5. Contracts Package Will Become a Bottleneck
**File**: `packages/contracts/src/index.ts`

Currently all types (auth, superadmin users, API errors) are in a single package with a flat export. At 30 services, every change to any contract recompiles and re-types the entire monorepo.

**Fix**: Split contracts into sub-modules or per-domain packages (e.g., `@repo/contracts/users`, `@repo/contracts/billing`). Or at minimum, use barrel exports with clear domain boundaries so tree-shaking works.

---

## Security Concerns

### 6. Helmet Uses Default Configuration Only
**File**: `apps/backend/src/app.ts:67`

`helmet()` is applied with zero customization. This is fine as a baseline but:
- **No CSP headers** — your dashboard can load scripts from any origin
- **No `crossOriginEmbedderPolicy`** or `crossOriginOpenerPolicy` tuning

For a SaaS template that will handle user data, you should explicitly configure CSP to whitelist only your own origins.



### 8. No Account Lockout / Brute Force Protection
**File**: `apps/backend/src/lib/auth.ts`

Rate limiting exists but there's no progressive account lockout after repeated failed login attempts. Better Auth may handle some of this internally, but it's not explicitly configured.

### 9. Superadmin Password in Environment Variables
**File**: `apps/backend/src/lib/env.ts`, `turbo.json`

`SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` are environment variables used for bootstrapping. These appear in `turbo.json`'s `globalEnv`, meaning they're passed to **all** apps in the monorepo — including the landing page and dashboard. Only the backend needs these.

**Fix**: Remove from `globalEnv` and configure them only in the backend's turbo/env setup.



---

## Architectural Gaps

### 11. No Testing Infrastructure for Scale
**Current state**: 11 backend tests, 6 frontend tests. Good coverage of current features, but:
- No E2E tests (no Playwright/Cypress)
- No test factory/fixtures system for generating test data
- Integration tests hit a real DB (good!) but there's no test DB provisioning in CI
- CI doesn't spin up PostgreSQL — backend tests likely skip DB-dependent tests or use mocks

At 30 services, you need a test strategy: shared test utilities, factory functions, and CI with DB containers.

### 12. No API Versioning
All routes are `/api/...` with no version prefix. When you need to ship a v2 without breaking v1 clients, you'll need to retrofit this.

**Fix**: Consider `/api/v1/...` now while it's cheap. Or at least document the decision to defer.

### 13. No Observability Stack
- Pino logging exists but no **structured metrics** (Prometheus/OpenTelemetry)
- No **distributed tracing** — critical when you have 30 services calling each other
- No **health check depth** — the health endpoint only checks `SELECT 1`, not dependent services

For production, you need at minimum: metrics export, trace propagation, and readiness probes.


### 15. No Feature Flag System
Configuration is entirely environment-variable based. There's no mechanism to toggle features per-user or per-tenant. At scale, you'll need feature flags.

### 16. Missing Shared Utilities
These don't exist yet and will be needed:
- **Shared validation schemas** — Zod schemas in contracts for API boundaries
- **Shared error codes** — the current `ERROR_CODES` enum is good, but will need domain namespacing
- **Shared pagination types** — the pagination pattern in `listSuperadminUsers` should be extracted
- **Shared date/currency formatting** — when you have 30 pages, inconsistency creeps in

---

## Minor Issues / Code Smells


### 18. The `contracts` Package Exports Both Types and Runtime Code
**File**: `packages/contracts/src/auth.ts`

`deriveDefaultNameFromEmail`, `getHomePathForRole`, `hasAuthRole`, `parseAuthRoles` are runtime functions bundled in what's nominally a "types/contracts" package. This blurs the line between contracts and shared utilities.


---

## Summary: Priority Ranking

| Priority | Issue | Effort |
|----------|-------|--------|
| **High** | DB connection pooling (#1) | 10 min |
| **High** | Remove superadmin creds from globalEnv (#9) | 5 min |
| **High** | CSP headers / Helmet config (#6) | 30 min |
| **Medium** | Shared UI package (#4) | 2-3 hours |
| **Medium** | Route auto-registration (#2) | 1-2 hours |
| **Medium** | Frontend route organization (#3) | 1-2 hours |
| **Medium** | API versioning prefix (#12) | 30 min |
| **Medium** | Test strategy for CI (#11) | 3-4 hours |
| **Low** | Avatar auth gating (#7) | 1 hour |
| **Low** | Service file splitting (#17) | 1 hour |
| **Low** | Observability foundation (#13) | 2-3 hours |
| **Low** | Contracts package splitting (#5) | 2-3 hours |
| **Low** | Deployment docs/Dockerfiles (#14) | 2-3 hours |

**Overall**: This is a well-architected template with genuine production-grade patterns (service orchestration with compensation, magic byte validation, structured logging). The gaps are mostly about **scaling the patterns** that already exist, not fundamental redesigns. The highest-ROI fixes are the first three: connection pooling, credential scoping, and CSP headers.

# GLM Production-Readiness Review

**Date:** 2026-04-13
**Scope:** Full monorepo assessment for scaling to 30+ backend controllers/services and 40+ dashboard pages

---

## Verdict

The architecture and patterns are good. The code quality is high. But there are concrete gaps that will cause breakage or growing pain when the codebase scales. The foundation is genuinely well-built — the gaps are infrastructure that wasn't needed for the template but is required before shipping a real product.

---

## What's Solid (No Changes Needed)

- **Backend stack:** Express 5 + Prisma + Better Auth + Zod + Pino — modern, well-chosen combination
- **Error handling:** Global error handler with `HttpError`, Zod error mapping, request IDs, and structured logging is production-grade
- **Auth system:** Email verification, password reset, role-based access, signup mode control, session management — all solid
- **Validation pattern:** `validate()` middleware with Zod schemas is clean and reusable
- **Shared contracts package:** `@repo/contracts` for types shared between backend and frontend — correct pattern
- **Monorepo tooling:** Turborepo + pnpm workspaces + shared ESLint/TS/Prettier configs
- **Test suite:** 10 test files covering routes, services, middleware, error handling — real tests, not smoke
- **Security basics:** Helmet, CORS, body size limits, rate limiting, avatar path traversal protection

---

## Things That WILL Break at Scale

### 1. No Lazy Loading on the Frontend

`App.tsx` eagerly imports every page component. At 40 pages the initial JS bundle becomes enormous and time-to-interactive degrades badly.

Every route should use `React.lazy()` + `<Suspense>`:

```tsx
const HomeUser = React.lazy(() => import('@/pages/user/HomeUser'))

<Route
  path="profile"
  element={
    <Suspense fallback={<Loading />}>
      <ProfilePage />
    </Suspense>
  }
/>
```

### 2. App.tsx Is 724 Lines and Contains 6 Page Components

Login, Register, ForgotPassword, ResetPassword, VerifyEmail, RegistrationDisabled — all defined inline in `App.tsx` alongside layout components and helpers. Each auth page should be its own file under `features/auth/pages/` or `pages/auth/`. The routing definitions stay in `App.tsx`; the components move out.

### 3. No React Error Boundary

If any page throws during render (bad data, missing prop, network error), the entire app goes white screen. At minimum wrap route outlets with an `ErrorBoundary`. Ideally add per-section boundaries so a crash in one area doesn't kill the whole UI.

### 4. File Uploads Go to Local Disk

`upload-avatar.ts` writes to the filesystem. This will not work in any containerized or multi-instance deployment. Abstract storage behind an interface (S3, R2, GCS) now so every future upload (documents, exports, whatever the SaaS needs) uses the same backend.

### 5. Rate Limiting Is In-Memory

The custom rate limiter stores state in a Map. This works for a single instance but fails the moment you run 2+ backend processes. Use Redis-backed rate limiting before shipping.

---

## Things That Will Cause Growing Pain

### 6. No Production Dockerfile or CI/CD

`docker-compose.localhost.yml` exists for dev, but there is no production Dockerfile for the backend or the dashboard and no CI/CD pipeline (no `.github/workflows/`). These are needed before the first real deploy.

### 7. No API Documentation

At 30 endpoints, Swagger/OpenAPI becomes essential. The existing Zod schemas make this straightforward to add with `@asteasolutions/zod-to-openapi` or similar. Much easier to wire in now than to retrofit later.

### 8. No Reusable Pagination Component (Frontend)

The backend already returns paginated responses (`listSuperadminUsers` with page/pageSize/totalItems/totalPages), but the frontend has no reusable pagination component. Every list page for domain entities will need one.

### 9. Authorization Is Too Thin

`user-policy.ts` has one function that checks role + ID match. With 30 services, resource-level authorization (can this user access this organization/project/resource?) is needed. The `utils/authorization/` folder is the right place, but the pattern needs to be richer before adding domain logic.

### 10. No Development Data Seeding

There is a seed script for the superadmin, but no seed system for development data (test users, sample data). At 30 entities, a proper seeding system is needed so developers can spin up a realistic local environment quickly.

---

## SaaS-Specific Missing Pieces

### 11. No Payment/Billing Integration

For a SaaS template, Stripe (or similar) integration is core infrastructure. The Stripe client setup, webhook handler pattern, and subscription model in the Prisma schema should be in place before building product features.

### 12. No Organization/Multi-Tenancy

The auth model is flat: user and superadmin. If the SaaS has teams, organizations, or workspaces, that needs to be designed into the data model and auth system early. Better Auth supports organizations, but the plumbing is not wired up.

### 13. No Background Job System

No queue (BullMQ, etc.) or scheduled task system. Most SaaS products need this for welcome emails, report generation, cleanup jobs, etc. Wiring it in later means touching every service that could benefit from async processing.

---

## Priority Summary

### Ship Before Adding Any Product Features

| # | Issue | Impact |
|---|-------|--------|
| 1 | Lazy loading + code splitting on frontend | Bundle size at 40 pages |
| 2 | Break App.tsx into individual page files | Developer velocity |
| 3 | React Error Boundary | Resilience |
| 4 | Abstract file storage (S3/R2) | Multi-instance deployments |
| 5 | Production Dockerfile + CI/CD | Cannot ship without this |

### Strongly Recommended Before 30 Controllers

| # | Issue | Impact |
|---|-------|--------|
| 6 | Redis-backed rate limiting | Multi-instance |
| 7 | OpenAPI/Swagger | API maintainability |
| 8 | Reusable pagination component | Every list page needs it |
| 9 | Richer authorization pattern | Resource-level access control |
| 10 | Stripe integration | Payment infrastructure |

### Nice to Have but Not Blocking

| # | Issue | Impact |
|---|-------|--------|
| 11 | Development data seeding | Developer experience |
| 12 | Background job system | Async processing |
| 13 | Multi-tenancy/organizations | Depends on product |

# Plan Execution Review

Refactor commit: `bef4e4c` — "hardening basic and workflow"
Scope: 122 files, +13,570 / -1,172 lines
Date reviewed: 2026-04-13

---

## PLAN.md Compliance Scorecard

| # | Plan Item | Status | Notes |
|---|-----------|--------|-------|
| 1 | Backend service orchestration | **Mostly met** | Engine is clean and reusable; `updateMyProfile` doesn't use it; missing compensator on `auth.createUser` |
| 2 | Authorization structure | **Met** | Centralized in `user-policy.ts`; some exhaustiveness gaps; profile updates bypass policy |
| 3 | Remove debug-only surface | **Met** | Route removed, test asserts 404. `TEST_ERROR` dead code left in `http-error.ts` |
| 4 | Split App.tsx | **Met** | 75-line composition file; auth pages extracted; shared routes slightly loose |
| 5 | Lazy loading | **Partial** | `React.lazy` used, but single top-level `<Suspense>` causes shell flash on chunk loads |
| 6 | Error boundaries | **Met** | Top-level + section-level via `RoleShell`; `componentDidCatch` is a no-op (see issues) |
| 7 | Frontend test coverage | **Weak** | Auth routing and error boundary tests present; superadmin flows and profile are smoke-only |
| 8 | Replace rate limiter | **Met** | Uses `express-rate-limit`; route-specific limits; proper proxy handling |
| 9 | CI in repo | **Met** | All 5 checks run on PRs |
| 10 | Production deployment | **Met** | Dockerfiles + DEPLOYMENT.md; missing `client_max_body_size` breaks avatar uploads |
| 11 | Documentation cleanup | **Met** | Strong backend README; root README good; deferred list incomplete vs PLAN |

---

## High-Severity Issues

### 1. `createSuperadminUser` has no compensator for `auth.createUser`

**File:** `apps/backend/src/services/userServices.ts:192-208`

If the profile upsert fails after the user is created in Better Auth, an orphaned auth user with no profile is left behind. This is the most important place to have compensation. Either add a compensator that deletes the created user, or document why it's not possible and what manual remediation is required.

### 2. `DEPLOYMENT.md` reverse-proxy example breaks avatar uploads

**File:** `DEPLOYMENT.md:39-43`

The nginx reverse-proxy example has no `client_max_body_size` directive. Nginx defaults to 1MB, which will reject avatar uploads behind the proxy. This directly contradicts the documented "same-origin avatar delivery" contract. Add:

```nginx
client_max_body_size 10m;
```

inside the `/api/` location block.

### 3. Error boundary `componentDidCatch` is a no-op

**File:** `apps/dashboard/src/routes/route-error-boundary.tsx:30`

Production render errors are silently swallowed. React suppresses its own error logging when a boundary catches an error, so these errors become completely invisible to developers in production builds. Add at minimum:

```typescript
override componentDidCatch(error: Error, info: ErrorInfo) {
  console.error(`[${this.props.scopeLabel}] render error:`, error, info);
}
```

Or wire it to an error reporting service.

### 4. Missing `.dockerignore` across all three apps

No `.dockerignore` exists anywhere in the repo. Every `COPY` command sends the full context (`.git`, `node_modules`, `.tmp/uploads`, test artifacts) to the Docker daemon, causing slow builds and cache invalidation. Add a root-level or per-app `.dockerignore` that excludes at minimum:

```
.git
node_modules
dist
.tmp
*.test.*
```

---

## Medium-Severity Issues

### 5. Single top-level `<Suspense>` causes layout flash

**File:** `apps/dashboard/src/App.tsx:21`

The entire route tree (including sidebar and topbar) flashes to a loading spinner when any lazy chunk loads. Move `<Suspense>` closer to each lazy boundary or use per-route Suspense wrappers so only the content area shows a loading state.

### 6. `updateMyProfile` doesn't use the orchestration engine

**File:** `apps/backend/src/services/userServices.ts:633-691`

This function manually sequences Better Auth updates, Prisma writes, and filesystem operations in a flat try/catch with no compensation or structured logging. This is inconsistent with the pattern set by the superadmin functions and leaves a partial-failure gap (if Prisma upsert fails after Better Auth update succeeds, the avatar URL is updated in auth but profile data is not written).

### 7. `ensureAnotherActiveSuperadminRemains` called inside a step

**File:** `apps/backend/src/services/userServices.ts:397-399`

This guard should be a pre-check before orchestration begins (as it is in `updateSuperadminUserRole` at line 536). Running it inside a step means earlier steps' compensators fire unnecessarily if the check fails.

### 8. Divergent catch-block patterns between create and update

**File:** `apps/backend/src/services/userServices.ts`

- `createSuperadminUser` (line 270): always logs partial failures, then throws `mappedError ?? originalError`
- `updateSuperadminUser` (line 488): throws immediately if a `mappedError` exists, skipping the structured log

These should use the same pattern. `updateSuperadminUser` should log partial failures even when a mapped error exists.

### 9. User policy `default` branches suppress TypeScript exhaustiveness checking

**File:** `apps/backend/src/utils/authorization/user-policy.ts:42-43, 56-58`

The `default` branches in the switch statements silently return `false` / `'Access denied'`. Removing the `default` or adding a `never` assertion would cause TypeScript to flag missing cases when a new `UserPolicyAction` is added:

```typescript
default: {
  const _exhaustive: never = action;
  return false;
}
```

### 10. Backend Dockerfile copies everything into runtime image

**File:** `apps/backend/Dockerfile:33`

`COPY --from=build /app /app` includes build artifacts, test files, and dependencies for packages the backend doesn't need at runtime. Should copy only the runtime essentials:

```dockerfile
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/backend /app/apps/backend
COPY --from=build /app/packages /app/packages
```

### 11. `canUpdateUser` policy does not cover self-service profile updates

**File:** `apps/backend/src/utils/authorization/user-policy.ts:26`

A non-superadmin user cannot pass the `update` action check. Profile self-updates (`patchMyProfileController`) bypass the policy entirely. This is functionally correct but undocumented. If a future developer assumes `canPerformUserAction({ action: 'update', ... })` is the universal gate for all user mutations, they will miss the profile self-service path. Either document this boundary or add a `update-own-profile` action.

### 12. Ban compensation logic is semantically confusing

**File:** `apps/backend/src/services/userServices.ts:408-423`

The compensate function for `auth.banUser` re-bans the user if they were previously banned, which is semantically wrong — you're compensating a ban by banning again. If the user had a prior ban reason "spam" and the admin sent "abuse", compensation overwrites with the old reason, which works by coincidence but is fragile. A cleaner approach: always unban in compensation, since the step just banned them.

### 13. Nginx container configs lack production hardening

**Files:** `apps/dashboard/nginx.conf`, `apps/landing/nginx.conf`

Both configs are missing:
- `gzip on;` / `gzip_static on;` — every request serves uncompressed JS/CSS
- Caching headers for hashed static assets (Vite outputs `[name]-[hash].js` which could cache aggressively)
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`)

### 14. Superadmin read rate limit is lower than authenticated user limit

**File:** `apps/backend/src/middleware/rate-limit.ts:49`

`superadminReadRateLimit` is 120 req/min vs `authenticatedReadRateLimit` at 180 req/min. Superadmins get a lower read limit than normal users. This may throttle admin dashboards unintentionally.

### 15. Rate limiters placed after `requireRole` in routes

**File:** `apps/backend/src/routes/userRoutes.ts:29`

`superadminReadRateLimit` is applied after `requireRole('superadmin')`. If a non-superadmin hits the endpoint, the role check throws 403 before the rate limiter executes. An attacker could spam superadmin endpoints without hitting the rate limit. The rate limiter should be placed before the role check.

---

## Code Quality & Consistency Issues

### 16. Duplicated components across superadmin pages

`UserStatusBadges` is defined identically in `SuperadminUsersPage.tsx:57-63` and `SuperadminUserDetailPage.tsx:42-48`. `formatRoleLabel` is defined identically in both files at lines 46-49 and 37-40 respectively. Both should live in `superadmin-users-utils.ts` or a shared components file.

### 17. `window.setTimeout` not cleaned up in `ResetPasswordPage`

**File:** `apps/dashboard/src/routes/auth-pages.tsx:354`

`window.setTimeout(() => { navigate('/login', { replace: true }) }, 1200)` fires on an unmounted component if the user navigates away during the 1.2s window. Use a ref or `useEffect`-managed timeout instead.

### 18. Inconsistent guard component APIs

**File:** `apps/dashboard/src/routes/route-guards.tsx`

`GuestOnlyRoute` uses `<Outlet />` (must be a layout route), while `AuthenticatedRoute` and `ProtectedRoute` use `{children}` (wrapper components). A developer might try to use them interchangeably and get confused.

### 19. `uncompensatedSteps` conflates expected and failed states

**File:** `apps/backend/src/services/service-orchestration.ts:64`

`uncompensatedSteps` includes steps with no compensator (expected — irreversible operations) and steps whose compensator failed (a real problem). A downstream consumer checking `uncompensatedSteps.length > 0` will log errors even when all steps either compensated successfully or had no compensator. Split into `nonCompensableSteps` vs `compensationFailedSteps`.

### 20. `componentDidCatch` label says "Retry section" at app level

**File:** `apps/dashboard/src/routes/route-error-boundary.tsx:77`

`AppErrorBoundary` shows "Retry section" but it wraps the entire app, not a section. The label should be "Retry" or "Reload" at the app level.

### 21. `TEST_ERROR` dead code in `http-error.ts`

**File:** `apps/backend/src/lib/http-error.ts:5`

`TEST_ERROR` domain error code still exists after the debug route was removed. Should be cleaned up.

### 22. `createSuperadminUser` passes actor as target

**File:** `apps/backend/src/services/userServices.ts:177-183`

The policy check passes `context.actor.id` as the target userId, when the intent is to check admin-level creation privileges. A `'create'` action or a separate policy check would be clearer.

### 23. No TLS termination guidance in `DEPLOYMENT.md`

The reverse-proxy example is HTTP-only. A one-liner noting "add TLS termination in front of or within this nginx block" would help.

### 24. No concurrency control in CI workflow

**File:** `.github/workflows/ci.yml`

No `concurrency` group to cancel in-flight runs when a new commit is pushed, and no `timeout-minutes` to prevent hung runs from consuming runners indefinitely.

### 25. Root README "Deferred On Purpose" list is incomplete

**File:** `README.md:121-129`

Missing items from PLAN.md's "Explicitly Deferred" section: background job infrastructure, full OpenAPI/Swagger generation, general development data seeding system.

### 26. `AuthRouteLayout` has hardcoded Better Auth text

**File:** `apps/dashboard/src/routes/route-shell.tsx:38-41`

The informational paragraph about Better Auth is baked into a shared layout component. If the auth provider changes, this text needs manual updating. Consider making it a prop or removing it.

---

## Test Coverage Gaps

### Backend

| Area | What's tested | What's missing |
|------|---------------|----------------|
| `service-orchestration.ts` | Nothing directly | Unit tests for the engine: all-success, compensation failure, empty steps |
| `createSuperadminUser` | Happy path, 409 duplicate | Compensation on partial failure, `alreadyVerified` step, orphaned user scenario |
| `updateSuperadminUser` | Happy path, last-superadmin guard | Ban/unban happy paths, password change partial failure, compensation |
| `updateSuperadminUserRole` | Happy path | Compensation on reload failure |
| `user-policy.ts` | 4 cases (self-read, other-read blocked, self-disable blocked, role-change) | `update` action, superadmin read, disable happy path, self-role-change denial, `canPerformUserAction` boolean return |
| Rate limiter | Public route 429 after 120 req | 4 other limiters, user-ID-based keying, `Retry-After` / `RateLimit-*` headers |

### Dashboard

| Area | What's tested | What's missing |
|------|---------------|----------------|
| Route tree | 4 tests (login render, auth redirect, protected redirect, must-change-password) | Root `/` redirect, register, forgot-password, reset-password, verify-email, superadmin routes, catch-all `*` |
| Error boundary | 2 tests (app-level fallback, section-level fallback) | Retry success path, retry permanent failure, `preserveShell` rendering, navigation after error |
| SuperadminUsersPage | 1 smoke test (renders user row) | Search debounce, pagination, page size, create-user dialog, validation errors, loading/error/empty states |
| SuperadminUserDetailPage | 1 test (identity email update) | Disable/enable, password reset, role change, validation errors, confirmation dialogs |
| ProfilePage | 1 test (avatar removal + save) | Name editing, avatar upload/crop, file validation, loading/error states |
| `vitest.config.ts` | — | No coverage thresholds configured; no CI enforcement of coverage floor |

---

## What's Done Well

- **Orchestration engine design** — Generic, type-safe, compensators run in reverse with failure collection. A genuinely reusable pattern for future services.
- **Backend README** — One of the most thorough starter-template READMEs I've seen. Every `src/lib` file documented with purpose, usage rules, and anti-patterns.
- **Profile feature decomposition** — Types, schema, API, hooks, and display logic cleanly separated in `features/profile/`. The best-decomposed feature in the codebase.
- **Authorization centralization** — All policy decisions in one module. Controllers delegate instead of deciding inline.
- **CI workflow** — All 5 quality gates run on PRs with correct pnpm setup and caching.
- **Route structure** — App.tsx went from ~776 lines to 75. Auth pages fully extracted. Lazy loading in place.
- **Rate limiting** — Replaced custom `Map` limiter with `express-rate-limit`. Route-specific limits with IP-based and user-ID-based keys. Proper proxy trust configuration.
- **DEPLOYMENT.md** — Clear, concise deployment contract documentation with a concrete nginx reverse-proxy example.

---

## Recommended Fix Priority

### Do now (production correctness)

1. Add `client_max_body_size` to DEPLOYMENT.md nginx example (1 line, prevents avatar upload failures behind proxy)
2. Add error logging to `componentDidCatch` (1 line, prevents silent production render errors)
3. Add `.dockerignore` files (3 files, major build performance improvement)
4. Add compensator for `auth.createUser` in `createSuperadminUser` (closes the orphaned-user gap)

### Do soon (pattern consistency)

5. Move `ensureAnotherActiveSuperadminRemains` to a pre-check before orchestration
6. Align catch-block patterns between `createSuperadminUser` and `updateSuperadminUser`
7. Deduplicate `UserStatusBadges` and `formatRoleLabel` into shared files
8. Add Suspense wrappers per lazy boundary instead of one top-level
9. Clean up `TEST_ERROR` dead code from `http-error.ts`

### Do next (test coverage)

10. Add unit tests for `service-orchestration.ts` engine
11. Add compensation/partial-failure tests for `createSuperadminUser` and `updateSuperadminUser`
12. Expand `user-policy.ts` test coverage to all actions and edge cases
13. Add superadmin page tests for create, disable, enable, password reset, and role change flows
14. Add profile page tests for name editing and avatar upload/crop
15. Configure coverage thresholds in `vitest.config.ts`

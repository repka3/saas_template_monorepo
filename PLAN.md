# Validated Hardening Plan

## Summary

This plan replaces the earlier broad hardening pass with a narrower, validated follow-up list.

The scope here is based on:

- the current code in the repo
- the gaps that are still real after the recent refactor
- fixes that match the actual stack and deployment model
- documented framework and infrastructure behavior where that affects correctness

The goal is not to reopen every preference-level review comment. The goal is to close the gaps that are real, material, and still worth fixing.

## What This Plan Optimizes For

- Preserve the current lean starter contract.
- Fix real cross-system failure gaps before adding more features.
- Tighten the documented production baseline so it matches actual runtime behavior.
- Improve reliability and clarity where the current code is easy to misread or partially fail.

## Phase 1: Backend Correctness

### 1. Close the orphaned-user gap in `createSuperadminUser`

The current orchestration creates a Better Auth user first and then writes profile data in Prisma. If the Prisma step fails, the auth user remains behind with no profile row.

Current gap:

- `apps/backend/src/services/userServices.ts`
- `createSuperadminUser`

Concrete work:

- enable a supported Better Auth user-deletion path if that is the intended rollback mechanism
- add a compensator for `auth.createUser` when rollback is safe and supported
- if hard delete is intentionally not enabled, document the manual remediation path and log the partial-failure state explicitly
- add a direct test for the partial-failure scenario

Acceptance criteria:

- a failed create flow does not silently leave an orphaned auth user without a clear rollback or remediation path
- the failure mode is test-covered

### 2. Harden `updateMyProfile` partial-failure handling

`updateMyProfile` currently updates Better Auth image state and Prisma profile state in a flat flow. If one side succeeds and the other fails, the user can end up with inconsistent profile state.

Current gap:

- `apps/backend/src/services/userServices.ts`
- `updateMyProfile`

Concrete work:

- make the cross-system steps explicit
- define the failure policy for avatar updates and profile writes
- if Better Auth image state changes before Prisma fails, either compensate safely or log a structured partial-failure event
- keep uploaded-file cleanup in place for failed writes
- add tests for avatar update failure paths

Acceptance criteria:

- self-service profile updates have an explicit partial-failure policy
- auth state, Prisma state, and file cleanup behavior are test-covered

### 3. Move superadmin survivability checks before orchestration

Disabling the last active superadmin is already blocked, but one path performs the check inside an orchestration step instead of before the orchestration begins.

Current gap:

- `apps/backend/src/services/userServices.ts`
- `updateSuperadminUser`

Concrete work:

- move `ensureAnotherActiveSuperadminRemains` out of the `auth.banUser` step and into a pre-check before orchestration starts
- keep the existing pre-check shape used by `updateSuperadminUserRole`

Acceptance criteria:

- business-rule guards run before reversible mutation steps begin
- failed preconditions do not enter orchestration unnecessarily

### 4. Align partial-failure logging across user-management flows

The create and update flows do not currently handle mapped errors the same way in their catch blocks. That makes partial-failure logging less consistent than it should be.

Current gap:

- `apps/backend/src/services/userServices.ts`

Concrete work:

- use one catch-block pattern for create, update, and role-change flows
- log partial-failure summaries before returning mapped HTTP errors
- keep Better Auth error mapping behavior intact

Acceptance criteria:

- partial cross-system failures are logged consistently across the superadmin service flows
- mapped errors do not suppress useful operational logging

## Phase 2: Authorization Clarity

### 5. Make the user policy boundary explicit

Authorization was successfully centralized, but the current policy API is easy to misread as a universal gate for every user mutation. Self-service profile updates are intentionally outside that `update` action.

Current gap:

- `apps/backend/src/utils/authorization/user-policy.ts`
- `apps/backend/src/controllers/userControllers.ts`

Concrete work:

- either document that `patchMyProfileController` is a separate self-service path
- or add an explicit action such as `update-own-profile`
- tighten switch exhaustiveness with a `never` assertion instead of silent `default` fallbacks

Acceptance criteria:

- future contributors can tell which mutations are admin-managed and which are self-service
- adding a new policy action causes TypeScript to flag missing switch cases

## Phase 3: Frontend Reliability

### 6. Add application-owned logging for caught render errors

The dashboard now has error boundaries, but the boundary implementation does not report caught errors anywhere.

Current gap:

- `apps/dashboard/src/routes/route-error-boundary.tsx`

Concrete work:

- implement `componentDidCatch(error, info)` to log caught render errors
- wire the handler to an error-reporting service later if the starter gains one
- keep the existing fallback UI behavior

Acceptance criteria:

- caught render failures are visible in app-owned logging
- the boundary keeps the current recovery UX

### 7. Fix small routed-UI reliability issues

These are not structural blockers, but they are real cleanup items and they affect polish and correctness.

Current gaps:

- `apps/dashboard/src/routes/auth-pages.tsx`
- `apps/dashboard/src/routes/route-error-boundary.tsx`

Concrete work:

- clean up the delayed redirect timeout in `ResetPasswordPage` so it cannot fire after unmount
- change the app-level error boundary retry label so it matches the actual scope

Acceptance criteria:

- the reset-password route does not leave an uncontrolled timer behind
- app-level fallback copy matches the boundary scope

### 8. Treat route-level Suspense refinement as UX polish, not as a failed baseline

Lazy loading is already in place and meets the original baseline. The remaining issue is user experience: the top-level Suspense boundary can replace the shell during lazy loads.

Current gap:

- `apps/dashboard/src/App.tsx`

Concrete work:

- move Suspense boundaries closer to routed content where that improves UX
- keep the current route-splitting approach

Acceptance criteria:

- route-level code splitting remains the default
- loading a child route does not unnecessarily blank the whole shell

## Phase 4: Delivery Baseline

### 9. Fix the documented nginx upload limit

The production deployment guide currently omits `client_max_body_size` in the reverse-proxy example. The backend allows avatar uploads above nginx's default body-size limit.

Current gap:

- `DEPLOYMENT.md`

Concrete work:

- add `client_max_body_size` to the `/api/` proxy example
- keep the documented value aligned with `MAX_AVATAR_UPLOAD_BYTES`
- add a short TLS note so the example is not read as a complete production edge configuration

Acceptance criteria:

- the documented reverse-proxy shape does not reject valid avatar uploads by default
- deployment docs match the supported same-origin upload contract

### 10. Add Docker build-context hygiene

The repo currently ships Dockerfiles without `.dockerignore` files, and the backend runtime stage copies the full build workspace into the runtime image.

Current gaps:

- no `.dockerignore` files present
- `apps/backend/Dockerfile`

Concrete work:

- add `.dockerignore` coverage for the Docker build contexts used by this repo
- exclude `.git`, local dependency folders, build artifacts, temp upload directories, and test-only artifacts from the build context
- narrow the backend runtime `COPY --from=build` to the runtime files the backend actually needs

Acceptance criteria:

- Docker builds stop sending unnecessary local context
- the backend runtime image no longer contains the full build workspace by default

### 11. Sync documentation with the actual deferred scope

The root README deferred-items list no longer matches the current hardening plan and deployment docs.

Current gap:

- `README.md`

Concrete work:

- update the deferred list to match the intentionally unsupported baseline
- include the items that are still explicitly deferred rather than partially implied

Acceptance criteria:

- the README, deployment docs, and plan describe the same supported baseline

## Phase 5: Test Coverage Follow-Through

### 12. Add direct tests for the risky paths that remain

The repo has a much better baseline than before, but the remaining risk is concentrated in a few untested failure and recovery paths.

Priority test additions:

- unit tests for `service-orchestration.ts`
- `createSuperadminUser` partial-failure coverage
- `updateMyProfile` partial-failure coverage
- broader `user-policy.ts` action coverage
- frontend tests for the currently smoke-only superadmin and profile flows
- optional coverage thresholds in dashboard Vitest config once the current floor is acceptable

Acceptance criteria:

- the repo directly tests the cross-system failure paths that are easiest to regress
- coverage settings, if added, reflect an intentional floor rather than a token threshold

## Explicitly Out of Scope For This Pass

- replacing the current auth provider
- introducing Redis or multi-instance coordination as baseline infrastructure
- object storage abstraction for uploads
- broad nginx hardening beyond the documented baseline contract
- adding product-specific billing, organizations, or job systems
- refactoring purely stylistic duplication unless it materially helps a validated fix

## Exit Criteria

This plan is complete when:

- cross-system backend mutations have explicit rollback or remediation behavior where needed
- self-service profile updates have a defined partial-failure policy
- authorization boundaries are explicit and exhaustively typed
- caught render errors are visible to operators
- deployment docs no longer contradict backend upload behavior
- Docker build inputs and runtime image contents are intentionally scoped
- tests cover the remaining risky mutation and recovery paths

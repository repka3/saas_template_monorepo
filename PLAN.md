# Minimal Template Reset Plan

## Summary

This plan replaces the previous broad hardening pass with a minimal reset.

The template should optimize for:

- a clean small-SaaS baseline
- simple extension points
- explicit service logic
- manual operator recovery for rare bad states

The template should not optimize for speculative platform concerns.

## Locked Decisions

- Remove the "at least one active superadmin" rule.
- Do not treat Docker or deployment docs as part of the supported baseline right now.
- Accept rare cross-system partial failures between Better Auth and Prisma.
- On partial failure, log clearly and rely on manual remediation instead of stronger rollback logic.
- Keep fixes scoped to real correctness issues, not polish or infrastructure theater.

## Phase 1: Backend Simplification

### 1. Remove the last-superadmin invariant

Current issue:

- the service layer treats "at least one active superadmin must remain" as an application rule
- that rule adds policy and edge-case complexity the template does not need

Concrete work:

- remove `ensureAnotherActiveSuperadminRemains`
- remove the related checks from `updateSuperadminUser`
- remove the related checks from `updateSuperadminUserRole`
- allow banning or demoting the last superadmin
- keep bootstrap or seed scripts as the recovery path

Acceptance criteria:

- disabling the last superadmin is allowed
- demoting the last superadmin is allowed
- the backend no longer encodes this survivability policy

### 2. Keep `createSuperadminUser` failure handling simple

Current issue:

- `createSuperadminUser` creates the auth user before the Prisma profile row
- if the Prisma write fails, the auth user can remain without a profile row

Concrete work:

- keep the current create flow structurally simple
- do not add delete-user rollback logic
- log a structured partial-failure event when auth user creation succeeds and a later step fails
- make the failure path explicit in tests

Acceptance criteria:

- partial failure is visible in logs
- no stronger orchestration or compensating delete flow is added
- the failure path is test-covered

### 3. Keep `updateMyProfile` failure handling simple

Current issue:

- `updateMyProfile` can update Better Auth image state before the Prisma profile write
- if the Prisma write fails, auth state and profile state can diverge

Concrete work:

- keep the current flow explicit and simple
- do not add rollback logic for auth image changes
- log a structured partial-failure event when auth succeeds and Prisma fails
- keep uploaded-file cleanup for failed avatar writes
- add direct tests for the failure path

Acceptance criteria:

- partial failure is visible in logs
- uploaded temp files are still cleaned up on failed writes
- the failure path is test-covered

## Phase 2: Scope Cleanup

### 4. Remove deployment from baseline planning

Current issue:

- the repo and plan treat deployment artifacts as if they are part of the starter contract
- that creates scope and maintenance burden before the deployment model is even decided

Concrete work:

- remove deployment hardening work from this plan
- remove Docker and deployment docs from the supported baseline language in repo docs
- treat deployment as future product-specific work, not template-core work

Acceptance criteria:

- the plan does not include Docker hardening or reverse-proxy guidance
- the template baseline is described in terms of code structure and local development, not deployment assumptions

### 5. Remove non-blocking polish from this pass

Out of scope for this reset:

- routed Suspense UX refinement
- frontend error telemetry abstraction
- README/deferred-list polish beyond removing baseline contradictions
- broader frontend test expansion
- coverage thresholds
- stylistic refactors that do not fix a real defect

Acceptance criteria:

- this plan stays focused on backend correctness and template scope reduction
- non-blocking polish does not gate completion

## Tests

- `createSuperadminUser` logs partial failure when auth creation succeeds and Prisma profile write fails
- `updateMyProfile` logs partial failure when auth avatar update succeeds and Prisma profile write fails
- `updateMyProfile` still deletes uploaded temp files on failed avatar writes
- `updateSuperadminUser` allows disabling the last superadmin
- `updateSuperadminUserRole` allows demoting the last superadmin

## Exit Criteria

This pass is complete when:

- the backend no longer enforces last-superadmin survivability
- the two real cross-system failure paths are explicit, logged, and tested
- the plan no longer includes speculative deployment or polish work
- the template baseline is smaller and easier to reason about

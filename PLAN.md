# Better Auth Alignment Plan

Checked against official Better Auth documentation on 2026-04-12.

## Goal

Align the superadmin user-management implementation with Better Auth's documented model so that:

- Better Auth is the source of truth for auth-user lifecycle operations.
- Better Auth's documented admin roles and admin APIs are used for user management.
- Direct writes to Better Auth-managed auth records are removed or isolated to a clearly documented bootstrap exception.
- Custom app data remains custom, but is integrated in a way that does not fight Better Auth.

## Official Documentation Baseline

These are the live docs this plan is based on:

- Admin plugin: https://better-auth.com/docs/plugins/admin
- Options reference: https://better-auth.com/docs/reference/options
- Client concepts: https://better-auth.com/docs/concepts/client

Key documented points that drive this plan:

- Better Auth's admin plugin is the documented surface for creating users, updating users, setting roles, setting passwords, banning users, unbanning users, and revoking sessions.
- Admin operations require an authenticated admin account, or a user included in `adminUserIds`.
- The admin plugin's role system is the documented authorization model for admin capabilities.
- `user.additionalFields` is the documented place for app-specific user fields.
- `databaseHooks` is the documented place for lifecycle work tied to core user/account/session/verification writes.
- `hooks.before` and `hooks.after` are request lifecycle hooks, not a general replacement for user data synchronization.
- `emailVerification.sendOnSignUp` and `emailAndPassword.requireEmailVerification` are separate choices and must be decided deliberately.
- `baseURL` should be explicitly set, and `trustedOrigins` must handle the `request === undefined` case for direct `auth.api` calls if using a dynamic function.

## Current Repo Gaps Relative to the Docs

These are the main places where the repo currently diverges from the documented Better Auth model:

- `apps/backend/src/scripts/seed-superadmin.ts` writes directly to Better Auth-managed `user` and `account` rows, including the credential password hash.
- `apps/backend/src/services/userServices.ts` mixes Better Auth admin API calls with direct Prisma writes to auth-managed user fields.
- The app currently has two authorization sources of truth for privilege checks:
  - Better Auth `role`
  - app-specific `systemRole`
- `apps/backend/src/middleware/auth-guards.ts` and `apps/dashboard/src/App.tsx` gate access with `systemRole`, while Better Auth admin authorization is based on `role`.
- Banned-user handling is partially duplicated in a custom sign-in hook instead of relying on the admin plugin's documented ban behavior and messaging options.
- The forced-password-change flow uses a custom additional field correctly, but its lifecycle is managed partly through request hooks and partly through manual Prisma writes.

## Target State

The preferred end state is:

- Better Auth `role` becomes the single privilege source for `user` vs `superadmin`.
- `systemRole` is removed from auth and routing logic.
- If `systemRole` must remain temporarily for migration safety, it becomes transitional and derived, not independently authoritative.
- All auth-user mutations go through documented Better Auth APIs or documented Better Auth lifecycle hooks.
- App-specific profile data stays outside Better Auth core tables and is managed separately.
- Bootstrap provisioning is documented explicitly as either:
  - a Better Auth-compatible admin bootstrap flow, or
  - a one-time exception with hard boundaries and no ongoing operational dependence.

## Workstream 1: Freeze the Documentation Baseline

- Add a short internal doc section in `README.md` or `docs/auth.md` listing the Better Auth pages above as the canonical references.
- Note the exact repo assumptions this plan uses:
  - admin plugin stays enabled
  - Prisma adapter stays in use
  - email/password stays enabled
  - superadmin remains a Better Auth admin role
- Add a rule for future work: no direct writes to Better Auth-managed auth fields unless the docs explicitly require it or a bootstrap exception is documented.

Acceptance criteria:

- The repo has one place that names the official Better Auth pages as the source of truth for auth implementation decisions.

## Workstream 2: Consolidate Authorization Around Better Auth `role`

Preferred direction:

- Replace `systemRole`-based access checks with Better Auth `role` checks for `user` and `superadmin`.
- Keep `mustChangePassword` as an additional field because it is app-specific and documented additional fields are the right place for it.

Implementation steps:

- Audit every use of `systemRole` in backend middleware, dashboard route guards, redirects, contracts, and tests.
- Introduce a single auth-role helper that maps Better Auth role strings to app route decisions.
- Migrate route guards from `systemRole === 'SUPERADMIN'` to Better Auth `role` semantics.
- Remove `systemRole` from session-dependent UI logic after the migration is complete.
- Remove `systemRole` from the Prisma schema and contracts only after all call sites are migrated.

Fallback path if removal is temporarily too disruptive:

- Keep `systemRole` only as a compatibility field for one migration cycle.
- Make `role` the authority.
- Synchronize `systemRole` from `role` in one direction only, then delete it in a follow-up.

Acceptance criteria:

- There is one privilege source of truth.
- A user cannot be a Better Auth admin while the app considers them non-admin, or the reverse.

## Workstream 3: Move User Management Fully Onto Better Auth Admin APIs

Use the documented admin endpoints as the canonical mutation layer:

- `createUser`
- `listUsers`
- `getUser`
- `setRole`
- `setUserPassword`
- `adminUpdateUser`
- `banUser`
- `unbanUser`
- session revoke/list endpoints if needed

Implementation steps:

- Refactor `apps/backend/src/services/userServices.ts` so auth-managed fields are mutated only through Better Auth admin APIs.
- Stop writing auth-managed fields directly through Prisma in service methods.
- Keep Prisma reads only where needed for app-specific joins such as `profile`.
- For user creation:
  - create the auth user through Better Auth
  - attach app profile data in a separate step
  - make the failure behavior explicit and test it
- For user updates:
  - apply Better Auth changes first
  - apply profile changes second
  - make partial-failure handling explicit
- Decide whether the custom backend superadmin endpoints should remain:
  - keep them only if they add real app-specific value
  - otherwise prefer the documented Better Auth client plugin for dashboard admin screens

Acceptance criteria:

- No service method directly mutates Better Auth-managed auth fields through Prisma.
- Tests cover Better Auth API failures and cross-boundary partial failure cases.

## Workstream 4: Use `databaseHooks` for Better Auth Lifecycle Synchronization

The repo currently uses request hooks for some auth-related state transitions. Keep request hooks only for true request-level behavior. Use `databaseHooks` where the concern is tied to user lifecycle persistence.

Implementation steps:

- Review whether `mustChangePassword` clearing belongs in a request hook or in a documented Better Auth lifecycle callback.
- If a profile row should always exist for every auth user, create it from a `databaseHooks.user.create.after` flow instead of scattering profile creation logic.
- If any transitional role-to-systemRole sync remains, do it in one documented hook location, not in multiple services or scripts.

Acceptance criteria:

- User lifecycle synchronization logic lives in one documented Better Auth extension point.
- Request hooks are used only for request-scoped behavior.

## Workstream 5: Replace the Current Superadmin Seed Strategy

This is the biggest alignment issue.

Documented constraint from Better Auth:

- Admin operations require an authenticated admin or a user in `adminUserIds`.

Implication:

- Better Auth does not present the admin endpoints as an unauthenticated bootstrap mechanism.

Plan:

- Remove the current ongoing operational dependence on direct writes to `user` and `account`.
- Choose and document one bootstrap strategy.

Preferred bootstrap strategies to evaluate:

1. One-time sign-up + promotion path
- Create the first user through a normal Better Auth flow.
- Promote that user to admin through a controlled bootstrap path.
- Use documented admin roles and, if needed, documented `adminUserIds` during bootstrap only.

2. Explicit bootstrap exception
- Keep a one-time provisioning script only for initial environment setup.
- Document clearly that it is not part of normal user-management operations.
- Limit it to creating the initial admin identity and stop using direct writes after bootstrap.

Hard rule:

- The seed script must stop being the normal mechanism for syncing passwords, banning state, or long-term admin demotion logic.

Acceptance criteria:

- There is a documented bootstrap story.
- Direct writes to Better Auth-managed credential data are either gone or isolated to a clearly declared one-time exception.

## Workstream 6: Decide the Email Verification Policy Explicitly

The docs distinguish:

- sending verification emails
- requiring email verification before session creation

Implementation steps:

- Decide whether superadmin-created users should be able to sign in before verifying their email.
- If verification is required, enable `emailAndPassword.requireEmailVerification` and align the superadmin create flow with that policy.
- If verification is not required, document that the product intentionally allows login with a temporary password before email verification.
- Ensure the create-user UI labels match the actual Better Auth behavior.

Acceptance criteria:

- The sign-in policy for unverified users is explicit and matches Better Auth config.

## Workstream 7: Remove Duplicate Ban Logic Unless It Adds Proven Value

The admin plugin already documents ban behavior and ban messaging.

Implementation steps:

- Re-evaluate the custom banned-user sign-in hook in `apps/backend/src/lib/auth.ts`.
- If Better Auth's built-in ban behavior satisfies the UX requirement, remove the duplicate hook and use documented plugin configuration.
- If a custom message is still required, prefer the documented plugin option for banned-user messaging over a duplicate pre-sign-in query.

Acceptance criteria:

- Ban enforcement has one clear implementation path.

## Workstream 8: Tighten the Client Alignment

Implementation steps:

- Review whether the dashboard should use the Better Auth admin client plugin directly for admin operations that map 1:1 to documented endpoints.
- If backend wrapper endpoints remain, document why each one exists.
- Keep `createAuthClient` base URL handling aligned with the documented client setup.
- Keep client additional-field inference only for fields that truly remain as additional fields.

Acceptance criteria:

- The client uses documented Better Auth patterns with minimal custom indirection.

## Workstream 9: Testing and Verification

Add or update tests for:

- role-based access using Better Auth `role` as the authority
- bootstrap admin creation path
- create user through Better Auth plus profile creation failure handling
- password reset by superadmin plus `mustChangePassword` lifecycle
- ban and unban behavior
- email verification behavior based on the chosen policy
- session behavior after password changes and bans

Acceptance criteria:

- The test suite proves the app's auth behavior through Better Auth's documented flows, not through raw Prisma assumptions.

## Suggested Execution Order

1. Freeze the documentation baseline.
2. Decide whether `systemRole` will be removed immediately or kept for one migration cycle.
3. Refactor authorization to Better Auth `role`.
4. Refactor service-layer mutations to Better Auth admin APIs only.
5. Move lifecycle synchronization into `databaseHooks` where appropriate.
6. Replace the current seed strategy with a documented bootstrap story.
7. Resolve email verification policy.
8. Remove duplicate ban logic if unnecessary.
9. Update tests and repo docs.

## Done Definition

This plan is complete when all of the following are true:

- Superadmin privilege is defined by Better Auth's documented role model.
- Normal user-management operations do not write directly to Better Auth-managed auth records through Prisma.
- Additional fields are limited to truly app-specific user state.
- Bootstrap behavior is documented and tightly scoped.
- The dashboard and backend both reflect the same Better Auth-backed authorization model.
- The repo docs point future contributors to the official Better Auth documentation used here.

# Better Auth Final Plan

Checked against official Better Auth documentation on 2026-04-12.

## Canonical Documentation

- Admin plugin: https://better-auth.com/docs/plugins/admin
- Options reference: https://better-auth.com/docs/reference/options
- User and accounts: https://better-auth.com/docs/concepts/users-accounts
- Email flows: https://better-auth.com/docs/concepts/email
- Database hooks: https://better-auth.com/docs/concepts/database

## Non-Negotiable Decisions

- Better Auth is the source of truth for auth, identity, roles, bans, passwords, sessions, and user lifecycle.
- `systemRole` is deleted everywhere. No compatibility layer. No sync layer. No fallback.
- We do not preserve the current auth schema just because it already exists. The database can be reset.
- No direct Prisma writes to Better Auth-managed auth records in normal operation.
- The bootstrap path must use documented Better Auth mechanisms, not raw writes to `user` or `account`.
- The app stops inventing parallel auth concepts when Better Auth already has the concept.

## Final Target State

The auth model is:

- Better Auth `role` is the only authorization role field.
- `role` values are `user` and `superadmin`.
- `mustChangePassword` remains as a Better Auth `user.additionalFields` field because it is app-specific and tied to onboarding policy.
- Better Auth core fields handle identity:
  - `email`
  - `name`
  - `image`
  - `emailVerified`
  - `role`
  - `banned`
  - `banReason`
  - `banExpires`
- The app does not keep a second auth-facing role field.
- The app does not keep custom ban enforcement when the admin plugin already enforces bans.
- The app uses Better Auth request hooks only where the behavior is truly request-specific.

## Scope Decisions

This plan is not a migration plan. It is a replacement plan.

- Existing auth data can be discarded.
- Old auth migrations that exist only to support the mixed model can be removed or replaced.
- Tests, contracts, frontend types, routes, and backend services should be updated directly to the final model.

## Product Policy for This Phase

For this phase we use a simple Better Auth-native onboarding model:

- onboarding is admin-driven
- public self-sign-up is disabled after bootstrap
- email verification is not required for sign-in in this phase
- admin-created users receive a temporary password
- admin-created users must change their password on first successful login

This keeps the implementation aligned with Better Auth and removes unnecessary early-stage complexity.

If the product later decides to require verified email before sign-in:

- enable `emailAndPassword.requireEmailVerification`
- add `customSyntheticUser` before turning it on
- implement the verification flow for admin-created users explicitly

That is future work, not part of this plan.

## Final Architecture

### 1. Auth Config

`apps/backend/src/lib/auth.ts` will be rewritten to follow the Better Auth model cleanly:

- Keep explicit `baseURL`.
- Keep static `trustedOrigins`.
- Keep `emailAndPassword.enabled = true`.
- Remove `sendOnSignUp` because public sign-up is not the operating model for this phase.
- Remove the custom banned-user pre-sign-in hook.
- Set `bannedUserMessage` in the admin plugin config.
- Keep the request after-hook that clears `mustChangePassword` after a successful `/change-password`.
- Do not move that password-change cleanup to a database hook.

### 2. Roles and Access Control

Use Better Auth admin access control directly:

- Define Better Auth roles for `user` and `superadmin`.
- Make `superadmin` the full admin role using Better Auth admin access control.
- Remove `adminRoles` if custom access control is used.
- Pass the same Better Auth access control config to the client admin plugin when client-side permission checks are needed.
- Treat `role` as potentially multi-valued and centralize role parsing in one helper.

### 3. User Data Model

Use Better Auth fields for auth-owned identity data:

- self-service updates for `name` and `image` go through Better Auth `updateUser`
- admin updates for user identity go through `adminUpdateUser`
- password changes go through Better Auth password endpoints
- role changes go through `setRole`
- bans go through `banUser` and `unbanUser`
- session invalidation goes through Better Auth revoke-session endpoints

App-specific auth-adjacent state is limited to:

- `mustChangePassword`

We do not keep `systemRole`.

## Required Code Changes

### Workstream 1: Reset the Schema to the Better Auth Model

- Drop the current mixed auth schema and rebuild it for the final model.
- Remove `systemRole` from the Prisma schema and generated types.
- Remove any auth migration that exists only to support `systemRole` or the mixed old model.
- Remove the current superadmin seed strategy that writes directly to Better Auth tables.
- Regenerate Better Auth schema artifacts after plugin/config cleanup.

Acceptance criteria:

- No auth table contains `systemRole`.
- No bootstrap code writes password hashes or account rows directly.

### Workstream 2: Rewrite Better Auth Configuration

- In `authUserAdditionalFields`, keep only `mustChangePassword`.
- Remove `systemRole` from Better Auth additional fields.
- Replace the current admin plugin config with one clean Better Auth role model.
- Remove `blockBannedUserBeforeSignIn`.
- Configure `bannedUserMessage: 'Your account is disabled.'`.
- Keep `clearMustChangePasswordAfterPasswordChange` as the request after-hook for `/change-password`.

Acceptance criteria:

- The auth config contains one role model and one ban enforcement path.
- The only custom auth user field left for this phase is `mustChangePassword`.

### Workstream 3: Remove Mixed Prisma Auth Mutations

- Refactor backend services so Better Auth-managed fields are never mutated with Prisma.
- Replace self-service `user.image` writes with Better Auth `updateUser`.
- Replace self-service `user.name` writes with Better Auth `updateUser` if that flow exists in the current app.
- Keep Prisma out of `user`, `account`, and `session` mutations unless Better Auth itself is calling through the adapter.
- After admin `setUserPassword`, explicitly call `revokeUserSessions` for that target user.
- Keep any non-auth app data write separate and second, after the Better Auth operation succeeds.

Acceptance criteria:

- No normal service code directly mutates Better Auth-managed auth fields through Prisma.
- Admin password reset revokes active sessions for the target user.

### Workstream 4: Delete `systemRole` Across the Stack

- Remove `systemRole` from backend middleware.
- Remove `systemRole` from frontend route guards.
- Remove `systemRole` from contracts, DTOs, tests, and helper functions.
- Replace all route decisions with Better Auth `role`.
- Replace all privilege checks with Better Auth role or Better Auth permission checks.

Acceptance criteria:

- No route, API, contract, or test references `systemRole`.
- A user’s Better Auth `role` is the only role used by the app.

### Workstream 5: Simplify the Frontend to Better Auth

- Remove `inferAdditionalFields` usage for `systemRole`.
- Keep additional-field inference only for `mustChangePassword` if still needed on the client.
- Add the Better Auth admin client plugin if the dashboard directly uses admin actions or permission checks.
- Update route guards to use `user.role`.
- Remove or disable the register page and public registration route for this phase.

Acceptance criteria:

- The frontend consumes Better Auth session data directly.
- The frontend does not depend on app-defined auth role fields.

### Workstream 6: Replace Bootstrap with a Better Auth Bootstrap

Delete `apps/backend/src/scripts/seed-superadmin.ts`.

Bootstrap the first superadmin with documented Better Auth behavior:

1. Start from an empty database.
2. Create the first user through Better Auth sign-up.
3. Temporarily include that user’s id in `adminUserIds`.
4. Sign in as that user and promote the account with Better Auth `setRole` to `superadmin`.
5. Remove the temporary bootstrap `adminUserIds` entry.
6. Disable public sign-up for normal operation.

This is the only bootstrap story for this phase.

Acceptance criteria:

- No bootstrap step writes raw Better Auth user or account records.
- The first superadmin is created and promoted through Better Auth flows.

### Workstream 7: Keep Only the Right Hook

Keep:

- request after-hook for clearing `mustChangePassword` after successful `/change-password`

Remove:

- request hook that manually blocks banned users before sign-in

Do not introduce a database hook for password-change cleanup.

Acceptance criteria:

- Request hooks are used only for request-scoped behavior.
- There is no duplicate ban logic.

### Workstream 8: Update Tests to the Final Model

Rewrite tests around Better Auth behavior:

- bootstrap first-superadmin flow
- admin create user
- admin update user
- admin set password plus forced password change plus session revocation
- ban and unban behavior
- role-based routing using `role`
- self-service `updateUser` for identity fields
- forced password-change redirect behavior

Delete tests that assert the old `systemRole` model.

Acceptance criteria:

- The test suite describes Better Auth behavior, not the old mixed model.

## Implementation Order

1. Drop the old auth schema assumptions.
2. Rewrite Better Auth config.
3. Delete `systemRole` from backend, frontend, contracts, and tests.
4. Remove direct Prisma auth mutations.
5. Replace the seed script with the Better Auth bootstrap flow.
6. Disable public sign-up for normal operation.
7. Rewrite tests around the final Better Auth model.

## Done Means

This plan is complete when:

- `systemRole` no longer exists
- the seed script no longer exists
- the ban hook no longer exists
- route guards use Better Auth `role`
- self-service identity updates use Better Auth `updateUser`
- admin user management uses Better Auth admin APIs only
- admin password reset revokes user sessions
- the app can be started from an empty database and bootstrap its first `superadmin` without raw auth table writes

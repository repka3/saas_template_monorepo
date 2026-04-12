# Superadmin Users Backend Plan

## Guiding Principle

Use Better Auth's official APIs, plugins, and supported schema conventions wherever they exist.

- Disabling and enabling users must use Better Auth admin ban and unban flows.
- Creating users, updating auth-owned user fields, and setting passwords must use Better Auth APIs, not direct Prisma writes to auth tables.
- Do not keep a parallel app-owned active or inactive flag for account state.
- Custom app-level behavior is allowed only when Better Auth does not provide a supported primitive.
- `mustChangePassword` is one of those necessary app-level additions: Better Auth performs the password change, while the app enforces the first-login policy.

## Summary

This phase implements the backend for the superadmin `users` section inside the existing `userRoutes` / `userControllers` / `userServices` stack.

Endpoints to add:

- `GET /api/users` for paginated listing with optional search
- `POST /api/users` for superadmin-created users with temporary password and optional `alreadyVerified`
- `PATCH /api/users/:id` for updating sensible fields, disabling or enabling users, and resetting a temporary password

Forgot-password already exists in the project and remains on the standard Better Auth flow.

## Auth and Data Changes

### Better Auth admin foundation

- Enable the Better Auth admin plugin in `apps/backend/src/lib/auth.ts`.
- Configure Better Auth roles:
  - `user`
  - `superadmin`
- Grant the full admin permission set only to Better Auth `superadmin`.
- Set:
  - `defaultRole: "user"`
  - `adminRoles: ["superadmin"]`

### Role alignment

Keep the existing app-level `systemRole` because the backend and dashboard already use it, but align it with Better Auth `role`.

- `systemRole = SUPERADMIN` maps to Better Auth `role = "superadmin"`
- `systemRole = USER` maps to Better Auth `role = "user"`

### Prisma schema changes

Add the Better Auth admin plugin fields to `User` and `Session`:

- `User.role String @default("user")`
- `User.banned Boolean @default(false)`
- `User.banReason String?`
- `User.banExpires DateTime?`
- `Session.impersonatedBy String?`

Add one app-level field:

- `User.mustChangePassword Boolean @default(false)`

Remove the existing app-owned disabled-state field:

- remove `User.isActive`

Disabled-state ownership belongs to Better Auth only.

### Migration and seed updates

Add a migration that:

- adds the Better Auth admin columns
- backfills Better Auth `role`
- removes `User.isActive`
- sets `role = "superadmin"` where `systemRole = SUPERADMIN`
- sets `role = "user"` otherwise

Update `apps/backend/src/scripts/seed-superadmin.ts` so the seeded account always has:

- `systemRole = "SUPERADMIN"`
- `role = "superadmin"`
- `banned = false`
- `mustChangePassword = false`

The seed script is an explicit bootstrap exception to the "use Better Auth APIs" rule because it provisions the initial superadmin before any admin session exists. It may continue to write auth tables directly only for bootstrap and setup purposes.

### Auth schema exposure and auth runtime cleanup

Update `apps/backend/src/lib/auth-schema.ts` so `mustChangePassword` is included as a Better Auth additional field exposed in session and user payloads.

Update existing backend auth and runtime code to stop using `isActive`:

- remove `isActive` from Better Auth additional fields exposure
- replace sign-in disabled checks with Better Auth `banned`
- replace authenticated route disabled checks with Better Auth `banned`
- replace startup readiness checks that currently require an active superadmin with a not-banned superadmin check
- remove `isActive` from seed logic, selects, DTOs, and tests

## Endpoint Design

All three endpoints must be added in the existing user module, not in a new parallel admin module.

Files to extend:

- `apps/backend/src/routes/userRoutes.ts`
- `apps/backend/src/controllers/userControllers.ts`
- `apps/backend/src/services/userServices.ts`

### `GET /api/users`

Guards:

- `requireAuthenticatedUser`
- `requireSystemRole("SUPERADMIN")`

Query contract:

- `page` default `1`
- `pageSize` default `20`
- max `pageSize` `100`
- `query` optional, trimmed
- empty or whitespace-only `query` is treated as no filter

Implementation:

- Use Prisma for this listing, not Better Auth `listUsers`, because the required search spans both `User` and `Profile`.
- Search must use case-insensitive substring matching across:
  - `user.email`
  - `user.name`
  - `profile.firstName`
  - `profile.lastName`
- Use OR matching across those fields.
- Order by `createdAt desc`, then `id desc`.

Response shape:

- `users: SuperadminUser[]`
- `pagination: { page, pageSize, totalItems, totalPages }`

### `POST /api/users`

Guards:

- `requireAuthenticatedUser`
- `requireSystemRole("SUPERADMIN")`

Body contract:

- `email: string`
- `name: string`
- `firstName?: string | null`
- `lastName?: string | null`
- `temporaryPassword: string`
- `alreadyVerified?: boolean`

Validation:

- `temporaryPassword` must pass Zod validation with a minimum length of 12 characters

Behavior:

- Always create a normal user in v1.
- Use Better Auth admin API `createUser`.
- Do not write auth user, account, or password rows directly with Prisma.
- Pass Better Auth data so the created user has:
  - Better Auth `role = "user"`
  - app `systemRole = "USER"`
  - `mustChangePassword = true`
  - `emailVerified = alreadyVerified ?? false`
- After auth user creation succeeds, upsert the `Profile` row with `firstName` and `lastName`.
- Return the refreshed admin DTO.

Error behavior:

- duplicate email returns `409` with shared error code `conflict`

### `PATCH /api/users/:id`

Guards:

- `requireAuthenticatedUser`
- `requireSystemRole("SUPERADMIN")`

Allowed mutable fields:

- `email`
- `name`
- `firstName`
- `lastName`
- `emailVerified`
- `disabled`
- `disableReason`
- `temporaryPassword`

Not allowed in v1:

- `systemRole`
- Better Auth `role`
- promoting or demoting superadmins
- direct password hash updates
- direct writes to Better Auth ban fields without using Better Auth APIs

Behavior:

1. Load target user and profile, return `404` if missing.
2. Validate the full request and reject invalid combinations before any mutation.
3. If `email` changes and `emailVerified` is omitted, set `emailVerified = false`.
4. If `email`, `name`, or `emailVerified` changed, call Better Auth `adminUpdateUser`.
5. If `temporaryPassword` is provided, call Better Auth `setUserPassword` and set `mustChangePassword = true`.
6. If `disabled === true`, call Better Auth `banUser`.
7. If `disabled === false`, call Better Auth `unbanUser`.
8. Upsert `Profile` names and persist `mustChangePassword` via Prisma.
9. Return the refreshed admin DTO.

Safety rules:

- reject self-disable for the acting superadmin
- self-disable returns `403` with shared error code `forbidden`

Failure semantics:

- the endpoint is not fully atomic across Better Auth and Prisma
- if a Better Auth mutation succeeds and a later Prisma write fails, return `500`
- log the partial-update state with request id, actor id, target user id, and completed mutation steps
- do not attempt blind rollback of Better Auth changes
- Prisma writes in this endpoint must be idempotent and safe to retry

## Password Flows

### Forgot password

Forgot-password is already present and should remain on Better Auth's standard flow.

Current implementation already exists in:

- backend email and reset configuration in `apps/backend/src/lib/auth.ts`
- email templates in `apps/backend/src/lib/mailer.ts`
- frontend pages in `apps/dashboard/src/App.tsx`

That flow stays:

- `requestPasswordReset`
- email link
- `resetPassword`

### Forced first-login password change

This is separate from forgot-password.

Use an app-level flag:

- `mustChangePassword`

Rules:

- superadmin-created users start with `mustChangePassword = true`
- users reset to a temporary password also get `mustChangePassword = true`
- the actual password change must still happen through Better Auth

Do not implement password changes with Prisma.

Use Better Auth for actual password operations:

- admin-side temporary password reset: Better Auth `setUserPassword`
- user-side authenticated password change: Better Auth `changePassword`
- forgot-password reset: Better Auth `resetPassword`

App enforcement:

- add a dedicated middleware after `requireAuthenticatedUser`
- if `authContext.user.mustChangePassword === true`, return `403` with shared error code `forbidden` and message `Password change required`
- mount this middleware only on app routes that require a fully usable session
- Better Auth routes under `/api/auth/*` remain exempt
- if this phase introduces an app endpoint that clears the flag after a successful password change, that endpoint must also be exempt from the enforcement middleware
- frontend follow-up phase will redirect flagged users to `/change-password`
- after successful password change, the app clears `mustChangePassword`

## Validation and Contracts

Add shared contracts in `packages/contracts` for:

- `SuperadminUser`
- `ListUsersQuery`
- `ListUsersResponse`
- `CreateUserInput`
- `UpdateUserInput`

`SuperadminUser` must include:

- `id`
- `email`
- `name`
- `emailVerified`
- `systemRole`
- `role`
- `banned`
- `banReason`
- `banExpires`
- `mustChangePassword`
- `image`
- `createdAt`
- `updatedAt`
- `profile: { firstName: string | null, lastName: string | null }`

Implementation rule:

- use a dedicated admin select and mapper for superadmin endpoints
- do not reuse the existing self-service `userSelect`

Add Zod validation for:

- admin list query
- admin create body
- admin update params and body

Keep the current self-profile validation unchanged.

## Tests

Extend the existing backend Vitest and Supertest suite to cover:

- `401` for unauthenticated requests
- `403` for authenticated non-superadmins
- `404` when target user does not exist

`GET /api/users`

- default pagination
- explicit `page` and `pageSize`
- search by email
- search by user name
- search by profile first name
- search by profile last name
- empty results with valid pagination metadata
- whitespace-only query treated as no filter

`POST /api/users`

- successful create with unverified email
- successful create with `alreadyVerified = true`
- duplicate email conflict
- profile row created
- Better Auth role set to `user`
- `mustChangePassword = true`
- password validation rejects values shorter than 12 characters

`PATCH /api/users/:id`

- update email, name, and profile fields
- changing email without explicit `emailVerified` resets `emailVerified` to `false`
- changing email with explicit `emailVerified` applies the explicit value
- set `emailVerified`
- temporary password reset sets `mustChangePassword = true`
- disable user uses Better Auth ban flow
- enable user uses Better Auth unban flow
- reject self-disable
- partial Better Auth success plus later Prisma failure is logged and returns `500`

Auth and password enforcement

- sign-in is blocked for banned users
- authenticated app routes reject banned users
- protected app route rejects a user with `mustChangePassword = true`
- Better Auth password change and reset flow remains usable

Migration and compatibility cleanup

- migration removes `isActive`
- auth session payloads and DTOs no longer expose `isActive`
- startup readiness uses not-banned superadmin logic

## Assumptions

- This phase is backend-only.
- Pagination uses `page` and `pageSize`.
- V1 does not allow creating or changing superadmin accounts through these endpoints.
- Better Auth is the source of truth for auth-owned operations.
- Better Auth `banned` is the only disabled-state field in the final backend design.
- Custom app behavior is limited to what Better Auth does not natively model, mainly `mustChangePassword`.

# PLAN.md Review Against Better Auth Documentation

Reviewed 2026-04-12 against the same official doc pages referenced in the plan.

---

## 1. Factual Claims vs Documentation: What the Plan Gets Right

The following claims in the plan are confirmed accurate:

- Admin operations require an authenticated admin or a user in `adminUserIds`.
- `user.additionalFields` is the documented place for app-specific user fields.
- `databaseHooks` is documented for lifecycle work tied to core entity writes.
- `hooks.before` / `hooks.after` are request-level hooks, not general data-sync tools.
- `emailVerification.sendOnSignUp` and `emailAndPassword.requireEmailVerification` are independent options.
- `baseURL` should be explicitly set (relying on request inference is not recommended for security).
- `trustedOrigins` receives `undefined` for the request parameter during initialization when using a dynamic function.
- `createUser`, `adminUpdateUser`, `setUserPassword`, `banUser`, `unbanUser`, `setRole`, `listUsers` are all documented admin endpoints with the signatures the plan assumes.
- `createUser` accepts a `data: Record<string, any>` parameter that can pass additional fields.

No factual errors found in the documentation baseline section.

---

## 2. Critical Issues: Plan Recommendations That Conflict with the Docs

### 2.1 Workstream 4 misapplies `databaseHooks` for `mustChangePassword`

The plan says:

> Review whether `mustChangePassword` clearing belongs in a request hook or in a documented Better Auth lifecycle callback.

The current after-hook implementation (`clearMustChangePasswordAfterPasswordChange`) is **already correct** for its purpose. It targets only the `/change-password` path. Moving this to `databaseHooks.user.update.after` would be wrong because:

- `user.update.after` fires on **every** user update (admin edits, profile changes, email changes, etc.), not just password changes.
- A databaseHook receives the updated user row but has no knowledge of **which endpoint** triggered the write.
- The current request hook correctly gates on `ctx.path === '/change-password'` and checks `ctx.context.returned` for errors before clearing the flag.

**Recommendation**: The plan should explicitly confirm that `clearMustChangePasswordAfterPasswordChange` stays as a request after-hook. Only the profile-creation concern (ensuring a profile row exists for every user) is a good candidate for `databaseHooks.user.create.after`.

### 2.2 Workstream 7 understates the ban redundancy

The plan frames the ban hook as "partially duplicated" and suggests re-evaluation. The docs are more definitive than the plan indicates:

- Better Auth **automatically rejects** sign-in attempts from banned users. No application hook is needed.
- `banUser` **automatically revokes all existing sessions**. The current code does not need to do this manually.
- The plugin has a `bannedUserMessage` configuration option (default: *"You have been banned from this application. Please contact support if you believe this is an error."*).

The current `blockBannedUserBeforeSignIn` hook adds an **unnecessary Prisma query on every sign-in attempt** to check a condition that Better Auth already enforces. The cost is not just duplication; it is a per-request DB hit that does nothing.

**Recommendation**: The plan should state this as a definite removal, not a re-evaluation. Replace the hook with:

```typescript
adminPlugin({
  bannedUserMessage: 'Your account is disabled.',
})
```

And delete `blockBannedUserBeforeSignIn` entirely.

---

## 3. Gaps: Things the Plan Should Cover but Doesn't

### 3.1 `customSyntheticUser` is required if `requireEmailVerification` is enabled

The admin plugin docs explicitly warn that if you enable `requireEmailVerification` (or `autoSignIn: false`), you **must** configure `customSyntheticUser` to include the admin plugin's additional fields (`role`, `banned`, `banReason`, `banExpires`) plus any app additional fields. Without it, email enumeration protection will break because the synthetic user shape won't match the real one.

Workstream 6 discusses deciding the email verification policy but never mentions this requirement. If the decision is to enable `requireEmailVerification`, this is a **breaking prerequisite**.

### 3.2 `sendOnSignUp` does not fire for admin-created users

The plan discusses email verification policy (Workstream 6) but doesn't address a key behavioral gap: `sendOnSignUp` triggers on the `/sign-up/email` endpoint. When a superadmin creates a user via `auth.api.createUser`, this is **not** a sign-up endpoint. Verification emails will not be sent automatically for admin-created users.

If the product requires admin-created users to receive a verification email, this must be implemented explicitly (e.g., by calling `sendVerificationEmail` after user creation, or by documenting that admin-created users get a temporary password and skip email verification).

The current code passes `emailVerified: input.alreadyVerified ?? false` in the `data` field of `createUser`. This works, but the plan should make the full lifecycle explicit: if `alreadyVerified` is false, how does the user verify?

### 3.3 Direct Prisma writes to `user.image` are not addressed

The plan's acceptance criterion for Workstream 3 states:

> No service method directly mutates Better Auth-managed auth fields through Prisma.

However, `updateMyProfile` in `userServices.ts` writes directly to `user.image` via Prisma. The `image` field **is** a Better Auth core user field. Better Auth does not provide a dedicated user self-update API for fields like `image` or `name` (the admin `updateUser` exists, but there's no documented self-service mutation endpoint beyond `changeEmail`).

**Recommendation**: The plan should either:
- Explicitly note `image` (and possibly `name` for self-service) as a documented exception where direct Prisma writes are acceptable because Better Auth does not expose a self-service mutation API for these fields, or
- Route these through `auth.api.adminUpdateUser` using the user's own session (if the user has permission to update themselves).

### 3.4 Session revocation after superadmin password reset is not addressed

When a superadmin calls `setUserPassword` for a target user, the docs do not state that sessions are automatically revoked (unlike `banUser`, which explicitly revokes sessions). The plan mentions `revokeSessionsOnPasswordReset` in the `emailAndPassword` config but this applies to the self-service `/reset-password` flow, not the admin `setUserPassword` endpoint.

If a superadmin sets a temporary password for a compromised user, that user's existing sessions may remain active. The plan's test list (Workstream 9) includes "session behavior after password changes" but the implementation workstreams don't address adding an explicit `revokeUserSessions` call after `setUserPassword`.

**Recommendation**: After `setUserPassword` in `updateSuperadminUser`, call `auth.api.revokeUserSessions({ body: { userId } })` to ensure the target user is forced to re-authenticate.

### 3.5 `role` can be multi-valued

The docs state: *"Users can have multiple roles stored as comma-separated strings."* The `setRole` endpoint accepts `role` as `string | string[]`. The plan says:

> Better Auth `role` becomes the single privilege source for `user` vs `superadmin`.

This is fine for now, but the plan should note that equality checks like `role === 'superadmin'` will break if a user is ever assigned multiple roles. A utility function that checks `role.split(',').includes('superadmin')` would be more defensive. This matters especially for Workstream 2's "single auth-role helper."

### 3.6 Frontend session already includes `role` from the admin plugin

The plan discusses migrating from `systemRole` to `role` but doesn't mention that the admin plugin **already adds `role` to the user object** in the session. The frontend `authClient` already has access to `user.role` via the admin plugin schema extension. The migration path for the dashboard is simpler than the plan implies:

- `user.systemRole === 'SUPERADMIN'` becomes `user.role === 'superadmin'`
- No additional plugin or field inference is needed; the admin plugin schema handles it

The client-side `additionalFields` declaration for `systemRole` can be removed once the migration is complete, but the client does NOT need a new declaration for `role` -- the admin client plugin adds it.

### 3.7 `adminRoles` vs custom access control interaction

The docs state:

> `adminRoles` only applies when not using custom access control.

The current config uses **both** `adminRoles: ['superadmin']` and `roles: { user: userAc, superadmin: adminAc }`. The `roles` object constitutes custom access control. This means `adminRoles` may be silently ignored. The plan should verify which one actually controls admin authorization in this configuration and remove the other to avoid confusion.

---

## 4. Minor Issues and Suggestions

### 4.1 `trustedOrigins` static array is fine

The plan mentions the `request === undefined` caveat for `trustedOrigins`. The current code uses a static array `[env.CORS_ORIGIN]`, which avoids this issue entirely. This plan item is a non-issue for the current code and can be dropped or noted as already handled.

### 4.2 List queries via Prisma are appropriate

The plan groups `listUsers` reads under "Move User Management Fully Onto Better Auth Admin APIs" (Workstream 3). However, the current `listSuperadminUsers` does Prisma reads with profile joins, cross-field search (including `profile.firstName`/`profile.lastName`), and page-based pagination. Better Auth's `listUsers` endpoint cannot join to custom tables.

The plan's acceptance criterion says "No service method directly mutates Better Auth-managed auth fields through Prisma." The word **mutates** is correct and should stay, but the plan should explicitly clarify that **reads** via Prisma are fine and expected for queries that need app-specific joins.

### 4.3 `emailVerified` passed through `createUser` `data` field

In `createSuperadminUser`, `emailVerified` is passed inside the `data` object of `auth.api.createUser`. While `emailVerified` is a **core** Better Auth field (not an additional field), the docs say `data` accepts `Record<string, any>` including "Extra fields for the user." It likely works because Better Auth merges `data` into the user row, but this is undocumented behavior for core fields. Consider testing this explicitly, and if it doesn't work, set `emailVerified` through a follow-up `adminUpdateUser` call.

### 4.4 Suggested execution order tweak

The plan suggests resolving email verification policy (step 7) after refactoring mutations (step 4). Since `customSyntheticUser` is a **prerequisite** for enabling `requireEmailVerification` and the admin plugin schema must be coordinated, the email verification decision should be made earlier -- ideally as part of step 2 (alongside the `systemRole` decision) so the full user schema is settled before code is refactored.

---

## 5. Summary: Priority Actions

| Priority | Issue | Workstream |
|----------|-------|------------|
| **High** | Remove ban hook, use `bannedUserMessage` config | WS 7 |
| **High** | Confirm `adminRoles` vs `roles` interaction; remove dead config | WS 2 |
| **High** | Add `revokeUserSessions` after admin `setUserPassword` | WS 3 |
| **High** | Plan `customSyntheticUser` if `requireEmailVerification` will be enabled | WS 6 |
| **Medium** | Keep `mustChangePassword` clearing as request hook, not databaseHook | WS 4 |
| **Medium** | Document `user.image` direct-write exception | WS 3 |
| **Medium** | Address verification email gap for admin-created users | WS 6 |
| **Medium** | Handle multi-valued `role` in the auth-role helper | WS 2 |
| **Low** | Note that `role` is already on the session user from admin plugin | WS 2/8 |
| **Low** | Move email verification decision earlier in execution order | Order |
| **Low** | Clarify that Prisma reads are fine; only mutations are restricted | WS 3 |

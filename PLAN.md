# Better Auth Final Plan

## Verdict

- Status: **not production-ready yet**
- The Better Auth foundation is solid: explicit `baseURL` and `secret`, `trustedOrigins` configured, secure cookies enabled in production, Better Auth mounted before `express.json()`, and backend session checks use `auth.api.getSession()`.
- The remaining issues are not generic hardening nits. They are concrete auth-policy and operability gaps that can leave the system without a workable superadmin path or with partially implemented identity flows.

## Findings

### 1. Superadmin bootstrap can lock the system out

- Public sign-up is blocked after the first user by checking `prisma.user.count() === 0` in [apps/backend/src/lib/auth.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/lib/auth.ts:31).
- The current plan around `BETTER_AUTH_BOOTSTRAP_ADMIN_USER_IDS` is not workable as an app-level bootstrap mechanism:
  - the first signed-up user gets a generated ID that cannot be known in advance
  - Better Auth admin bootstrap and the app's own superadmin authorization are not the same thing
- The app gates superadmin routes on the persisted `user.role` field via [apps/backend/src/middleware/auth-guards.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/middleware/auth-guards.ts:45).
- New users created from the superadmin flow are hardcoded as `role: 'user'` in [apps/backend/src/services/userServices.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/services/userServices.ts:172).
- There is also a race window in the first-user sign-up check because two concurrent sign-ups can both pass the `count() === 0` gate before either insert completes.
- Result: the first user may exist, but nobody is deterministically promoted to `superadmin`, and the system can dead-end with zero usable superadmins.
- Severity: **blocker**

### 2. There is no in-app role promotion path

- `createSuperadminUser()` always creates users with `role: 'user'` in [apps/backend/src/services/userServices.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/services/userServices.ts:177).
- `updateSuperadminUser()` can change email, name, password, banned state, and verification state, but not role, in [apps/backend/src/services/userServices.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/services/userServices.ts:227).
- The current routes expose no role-management endpoint in [apps/backend/src/routes/userRoutes.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/routes/userRoutes.ts:21).
- The API contract also exposes no role field for updates in [packages/contracts/src/superadmin-users.ts](/home/luna/lavoro/saas_template_monorepo/packages/contracts/src/superadmin-users.ts:57).
- Result: even after bootstrap is fixed, the admin pool cannot be expanded through the application.
- Severity: **blocker**

### 3. Email verification is only partially implemented

- `sendVerificationEmail` exists in [apps/backend/src/lib/auth.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/lib/auth.ts:106).
- The current config does not set `sendOnSignUp`, `sendOnSignIn`, or `requireEmailVerification` in [apps/backend/src/lib/auth.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/lib/auth.ts:96).
- The frontend can redeem verification tokens, but there is no discovered resend-verification flow and no clear automatic trigger in the current user journey.
- A superadmin can manually mark a user as verified, but that is not an end-to-end verification policy.
- Result: verification plumbing exists, but the product behavior is incomplete and users can remain unverified indefinitely.
- Severity: **blocker**

### 4. Auth emails are awaited inline

- `sendResetPassword` awaits mail delivery in [apps/backend/src/lib/auth.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/lib/auth.ts:99).
- `sendVerificationEmail` also awaits mail delivery in [apps/backend/src/lib/auth.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/lib/auth.ts:107).
- This couples auth response timing to SMTP latency/failure and is below Better Auth guidance for email callbacks.
- Result: behavior works, but operationally it is weaker than it should be.
- Severity: **medium**

### 5. Frontend `adminClient()` should be treated as an architecture choice, not the main problem

- The frontend includes `adminClient()` in [apps/dashboard/src/lib/auth-client.ts](/home/luna/lavoro/saas_template_monorepo/apps/dashboard/src/lib/auth-client.ts:20).
- Better Auth admin endpoints already exist server-side because Better Auth is mounted directly at [apps/backend/src/app.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/app.ts:70).
- That means `adminClient()` is not what creates the second authorization surface; it exposes a client helper for one that already exists.
- The real concern is consistency: if the app keeps both Better Auth admin endpoints and custom Express superadmin routes, the authorization rules and intended ownership of each path should be explicit.
- Severity: **medium**

### 6. Custom Express routes do not appear to have rate limiting

- Better Auth has its own auth-route protections, but the custom `/api/superadmin/*` and `/api/users/*` routes do not currently show any rate-limiting middleware.
- This is lower risk because the routes are session-protected, but it is still a production hardening gap.
- Severity: **low**

### 7. `mustChangePassword` currently works through route separation

- Custom routes are blocked by `requirePasswordChangeNotRequired` in [apps/backend/src/routes/userRoutes.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/routes/userRoutes.ts:19) and [apps/backend/src/middleware/auth-guards.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/middleware/auth-guards.ts:34).
- The actual password change flow succeeds because Better Auth handles `/api/auth/change-password` outside those Express guards in [apps/backend/src/app.ts](/home/luna/lavoro/saas_template_monorepo/apps/backend/src/app.ts:70).
- This works today, but the dependency is implicit and fragile under refactoring.
- Severity: **info**

## Required Changes

### Priority 1

- Implement one deterministic first-superadmin bootstrap path.
- Do not rely on an unknown future user ID being manually pre-listed.
- Acceptable options:
  - create the first superadmin explicitly through a seed or CLI bootstrap command
  - auto-promote the first successful sign-up to `superadmin` in a controlled post-sign-up flow
  - document a deliberate operator bootstrap procedure if you intentionally want Better Auth admin bootstrap plus a follow-up role assignment step

### Priority 2

- Add a real role-management flow for existing superadmins.
- Preferred shape: add a dedicated endpoint such as `PATCH /api/superadmin/users/:id/role` and call the appropriate Better Auth admin API from the backend.
- Extend the shared contract and validation schema to support role changes explicitly.

### Priority 3

- Choose and implement one email-verification policy end to end.
- Either:
  - enforce verification before login with automatic verification sending
  - or allow unverified users intentionally and provide a clear resend-verification self-service flow

### Priority 4

- Stop awaiting SMTP delivery inside Better Auth callbacks.
- Dispatch email out of band and log failures separately.

### Priority 5

- Decide which admin surface is canonical.
- If custom Express superadmin routes are the intended product boundary, keep Better Auth admin usage behind the backend where possible and avoid accidental frontend dependency on raw admin endpoints.
- If both surfaces remain, document which operations belong to each and ensure the authorization model is deliberately aligned.

### Priority 6

- Add rate limiting to custom authenticated routes before production.

### Priority 7

- Add a short code comment or test coverage documenting why `mustChangePassword` still allows the Better Auth password-change route to function.

## Verification To Add

- bootstrap success for the first superadmin
- bootstrap failure and recovery path
- prevention of zero-superadmin lockout
- role promotion and demotion rules
- resend and verify email flow
- sign-in behavior for unverified users under the chosen policy
- auth email callback behavior when mail delivery fails

## References

- Better Auth options: https://better-auth.com/docs/reference/options
- Better Auth email docs: https://better-auth.com/docs/concepts/email
- Better Auth admin plugin: https://better-auth.com/docs/plugins/admin
- Better Auth security reference: https://better-auth.com/docs/reference/security

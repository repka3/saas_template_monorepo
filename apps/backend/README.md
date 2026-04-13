# Backend README

This backend is the reusable API baseline for the monorepo:

- Express 5 for HTTP routing and middleware
- Better Auth for authentication, sessions, password reset, verification, and admin operations
- Prisma + PostgreSQL for persistence
- Zod for request validation
- Pino for structured logging

The goal is not to hide those tools behind a large custom framework. The goal is to keep the project easy to extend, easy to upgrade, and explicit about where each responsibility lives.

For stable backend implementation rules, see [AGENTS.md](./AGENTS.md). For the full controller/service error-handling policy, see [ERROR_HANDLING.md](./ERROR_HANDLING.md).

## Mental model

The backend has five main layers:

1. `src/lib`
   Shared infrastructure and cross-cutting primitives.
2. `src/middleware`
   HTTP concerns: auth guards, validation, rate limiting, uploads, final error handling.
3. `src/routes`
   Route registration and middleware composition only.
4. `src/controllers`
   Thin HTTP handlers: read request data, call a service, return the response.
5. `src/services`
   Business logic, Better Auth orchestration, Prisma queries, and domain invariants.

The default request flow is:

`route -> middleware -> controller -> service -> controller response`

If something fails:

`throw HttpError / rejected promise -> errorHandler -> standard JSON error envelope`

## Boot and request flow

These files define the application lifecycle:

- `src/lib/env.ts`
  Parses and validates all required environment variables once at startup.
- `src/lib/prisma.ts`
  Creates the Prisma client singleton.
- `src/lib/auth.ts`
  Defines the single Better Auth instance for the whole backend.
- `src/app.ts`
  Composes middleware, mounts Better Auth, mounts routers, and installs the final 404 + error handler.
- `src/server.ts`
  Starts the HTTP server and handles graceful shutdown.

The important ordering in `src/app.ts` is deliberate:

1. request logging
2. CORS and security middleware
3. Better Auth mount on `/api/auth/*`
4. JSON and URL-encoded body parsing
5. static assets
6. app routers
7. 404 fallback
8. final `errorHandler`

That Better Auth mount order matters. Better Auth documents that its handler should be mounted before `express.json()` on Express, and this backend follows that rule so auth endpoints keep working correctly.

## Why `src/lib` exists

`src/lib` is for shared infrastructure, not for feature logic.

Every file under `src/lib` should answer at least one of these questions:

- Is this app-wide infrastructure?
- Is this cross-cutting behavior reused by multiple features?
- Is this a low-level primitive that should not depend on route/controller code?

If the answer is no, it probably does not belong in `lib`.

### `src/lib/api-error-response.ts`

Purpose:
Builds the standard API error payload returned to the frontend.

Why it exists:
It keeps error responses consistent everywhere and centralizes `requestId` propagation.

Use it for:
Returning the backend-wide error envelope from the 404 handler and the final error middleware.

Do not use it for:
Business rules or deciding which error to throw. That belongs in services or middleware.

### `src/lib/auth-schema.ts`

Purpose:
Keeps app-specific auth schema helpers in one place.

Why it exists:
Better Auth owns the auth system, but the app still has a few explicit app-level auth concepts such as roles and the `mustChangePassword` additional field.

Use it for:
Shared role helpers re-exported from `@repo/contracts` and Better Auth `additionalFields`.

Do not use it for:
Defining runtime auth flows or calling Better Auth APIs directly.

### `src/lib/auth.ts`

Purpose:
Defines the single Better Auth instance and its official configuration.

Why it exists:
This is the backend's auth boundary. All Better Auth plugins, callbacks, hooks, and adapter wiring live here so upgrades stay localized.

Use it for:

- Better Auth config
- plugin registration
- auth hooks
- email verification and password reset callbacks
- adapter configuration

Do not use it for:

- feature-specific route logic
- ad hoc auth helpers spread across the repo
- direct Prisma business queries unrelated to auth configuration

### `src/lib/env.ts`

Purpose:
Validates runtime environment variables.

Why it exists:
Startup should fail immediately if required config is invalid. That is safer than discovering broken config on the first request.

Use it for:
Parsing and typing env vars once.

Do not use it for:
Feature flags implemented as ad hoc string checks all over the codebase.

### `src/lib/http-error.ts`

Purpose:
Defines the backend's expected application error type.

Why it exists:
Controllers, services, and middleware need a common way to communicate intentional HTTP failures to the final error handler.

Use it for:
Expected failures such as `not_found`, `forbidden`, `conflict`, and structured error details.

Do not use it for:
Unexpected infrastructure failures. Let those throw normally and become a 500.

### `src/lib/logger.ts`

Purpose:
Creates the shared Pino logger.

Why it exists:
The whole backend should emit structured logs with the same base metadata and level control.

Use it for:
Application logs, startup logs, cleanup warnings, and non-request background failures.

Do not use it for:
Formatting user-facing API responses.

### `src/lib/mailer.ts`

Purpose:
Owns SMTP transport and auth email composition/dispatch.

Why it exists:
Auth emails are infrastructure concerns, not controller concerns.

Use it for:

- verification emails
- password reset emails
- async dispatch logging

Do not use it for:
Feature-specific notification systems unless they truly share the same transport abstraction.

### `src/lib/prisma.ts`

Purpose:
Creates and exports the Prisma client singleton.

Why it exists:
The app should not instantiate Prisma in random files, and development should avoid duplicate clients across reloads.

Use it for:
Database access from services, auth config, and controlled scripts.

Do not use it for:
Putting business queries in `lib` just because they need Prisma.

### `src/lib/logging/build-error-log-context.ts`

Purpose:
Builds the structured metadata logged when a request fails.

Why it exists:
The error handler should log enough context to debug a failure without duplicating that formatting logic inline.

Use it for:
Request-scoped error logs.

Do not use it for:
Business auditing or analytics events.

### `src/lib/logging/sanitize.ts`

Purpose:
Redacts sensitive values before they are written to logs.

Why it exists:
Request logging is useful only if it is safe. Passwords, tokens, cookies, secrets, and similar values should never leak into logs.

Use it for:
Sanitizing request bodies or other objects before logging them.

Do not use it for:
Input validation or security policy decisions.

## What does not belong in `lib`

Do not put these in `src/lib`:

- routes
- controllers
- feature-specific services
- feature-specific authorization policies
- Prisma queries that belong to one feature
- "helper" files that only exist to avoid choosing a real layer

If something is specific to users, billing, organizations, uploads, or another feature, prefer `services`, `validation`, `middleware`, or `utils` near that feature boundary.

## Better Auth rules for this project

This backend should stay close to Better Auth's documented usage instead of layering custom hacks on top of it.

### The rules

1. `src/lib/auth.ts` is the only Better Auth definition.
2. Mount Better Auth before `express.json()`.
3. Import from official Better Auth entrypoints only.
4. Use `auth.api.*` for auth-owned mutations and reads when the operation belongs to Better Auth.
5. Pass `fromNodeHeaders(req.headers)` when a server-side Better Auth API call needs the current session cookies.
6. Keep `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and `trustedOrigins` explicit.
7. Keep app-specific auth extensions minimal and documented.
8. Re-check Better Auth schema/plugin requirements when upgrading Better Auth or changing plugins.

### What counts as an auth-owned operation

These should go through Better Auth APIs, not direct Prisma writes inside normal request handling:

- get session
- sign up / sign in flows
- role changes
- banning / unbanning
- password changes or resets
- revoking sessions
- updating Better Auth-owned user fields

This backend already follows that pattern in `userServices.ts` for normal runtime behavior.

### What direct Prisma writes are still valid

Direct Prisma writes are fine when the data is clearly app-owned or when Better Auth is not the right abstraction:

- app profile rows
- app search queries and list queries
- app-specific read models
- controlled bootstrap or maintenance scripts where no authenticated actor exists yet

The key rule is simple:

- runtime auth behavior -> prefer Better Auth APIs
- app data and app queries -> Prisma in services

### Upgrade-safe Better Auth habits

To keep Better Auth upgrades boring:

- do not scatter Better Auth config across many files
- do not reach into undocumented internals
- do not emulate Better Auth endpoint behavior manually in controllers
- do not mutate auth tables directly in normal request flows when an official `auth.api.*` method already exists
- keep custom hooks small and tied to documented hook points
- when plugins or auth schema change, verify the schema and adapter setup before shipping

Official docs used as the reference for these rules:

- Better Auth installation and Express handler guidance: <https://better-auth.com/docs/installation>
- Better Auth options reference: <https://better-auth.com/docs/reference/options>
- Better Auth Prisma adapter: <https://better-auth.com/docs/adapters/prisma>
- Better Auth email/password: <https://better-auth.com/docs/authentication/email-password>
- Better Auth admin plugin: <https://better-auth.com/docs/plugins/admin>

## Error handling in Express 5

Express 5 simplifies the normal controller story.

For `async` route handlers and `async` middleware, you can just throw:

```ts
export const getSomethingController: RequestHandler = async (req, res) => {
  const result = await loadSomething(req.params.id)

  if (!result) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'Resource not found')
  }

  res.status(200).json({ result })
}
```

You do not need the old pattern:

```ts
try {
  // ...
} catch (error) {
  next(error)
}
```

That old wrapper is usually noise now.

### Default rule

Controllers should normally:

- read typed request data
- call one service
- send the HTTP response
- throw expected errors directly

Controllers should not normally:

- start with a `try`
- translate many error types
- contain rollback logic
- contain Prisma queries
- contain Better Auth orchestration

### When `try/catch` is still correct

Local `try/catch` is still valid when you need one of these:

- cleanup work
  - example: delete an uploaded file if later validation fails
- error translation
  - example: map Better Auth `APIError` codes to backend `HttpError`
- partial-success logging
  - example: log which external mutation steps already completed before a later step failed
- callback-based middleware integration
  - example: Multer still uses callback-style control flow

That is already how this codebase uses `try/catch` today.

### Standard backend error shape

Expected errors should become a `HttpError`, then the final `errorHandler` turns them into:

```json
{
  "error": {
    "code": "not_found",
    "message": "User not found",
    "requestId": "..."
  }
}
```

The error code should come from `@repo/contracts` unless the code is a deliberate backend domain code registered in `src/lib/http-error.ts`.

## Route / controller / service schema

For a normal JSON endpoint for an authenticated user, follow this shape.

This is the default pattern. Multipart uploads such as avatar changes are a special case and can use dedicated middleware.

### 1. Validation schema

```ts
// src/validation/user-settings.ts
import { z } from 'zod'

export const updateUserSettingsSchema = z.object({
  timezone: z.string().trim().min(1).max(100),
  marketingEmails: z.boolean(),
})

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>
```

### 2. Route

The route composes middleware. It should not contain business logic.

```ts
// src/routes/userRoutes.ts
userRouter.patch(
  '/users/me/settings',
  requireAuthenticatedUser,
  authenticatedRouteRateLimit,
  requirePasswordChangeNotRequired,
  validate({ body: updateUserSettingsSchema }),
  updateMySettingsController,
)
```

### 3. Controller

The controller is thin. It reads request data, calls the service, and returns the response.

```ts
// src/controllers/userControllers.ts
import type { RequestHandler } from 'express'

import { updateMySettings } from '../services/userServices.js'
import { getAuthUserId } from '../utils/auth-utils.js'
import type { UpdateUserSettingsInput } from '../validation/user-settings.js'

export const updateMySettingsController: RequestHandler<never, { user: unknown }, UpdateUserSettingsInput> = async (req, res) => {
  const actorUserId = getAuthUserId(res)
  const user = await updateMySettings(actorUserId, req.body)

  res.status(200).json({ user })
}
```

### 4. Service

The service owns business logic and persistence.

```ts
// src/services/userServices.ts
import { ERROR_CODES } from '@repo/contracts'

import { HttpError } from '../lib/http-error.js'
import { prisma } from '../lib/prisma.js'
import type { UpdateUserSettingsInput } from '../validation/user-settings.js'

export const updateMySettings = async (actorUserId: string, input: UpdateUserSettingsInput) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { id: true },
  })

  if (!existingUser) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
  }

  return prisma.user.update({
    where: { id: actorUserId },
    data: {
      timezone: input.timezone,
      marketingEmails: input.marketingEmails,
    },
  })
}
```

### Why this split works

- Routes stay readable.
- Controllers stay small.
- Services stay testable.
- Error handling stays centralized.
- Better Auth logic does not leak into route files.

## How to add a new endpoint

Use this checklist.

1. Decide whether the endpoint is public, authenticated, or role-restricted.
2. Add or update shared contracts in `@repo/contracts` only if another app consumes the shape.
3. Add a Zod schema in `src/validation` for `body`, `params`, or `query`.
4. Register the route and compose middleware in `src/routes`.
5. Keep the controller thin.
6. Put the real logic in a service.
7. Throw `HttpError` for expected failures.
8. If Better Auth owns the operation, call `auth.api.*` from the service.
9. Add or update tests for the route or service behavior.

## Current folder guidance

- `src/routes`
  Route declarations only.
- `src/controllers`
  HTTP handlers only.
- `src/services`
  Business logic and data orchestration.
- `src/validation`
  Zod request schemas.
- `src/middleware`
  Reusable HTTP pipeline pieces.
- `src/utils`
  Small helpers and local policies that are not app-wide infrastructure.

If you feel tempted to add a new generic helper file, stop and ask which layer actually owns the behavior.

## Practical rules for future work

- Prefer one controller calling one main service.
- Prefer throwing over local `try/catch` in normal async handlers.
- Prefer `HttpError` for expected failures.
- Prefer shared `ERROR_CODES` over inline string codes.
- Prefer Better Auth APIs for auth-owned state.
- Prefer Prisma in services for app-owned data.
- Prefer small, obvious boundaries over clever abstractions.

That is the backend style this template is aiming for.

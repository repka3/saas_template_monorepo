# Backend Error Handling

## Goal

Define one error-handling strategy for the backend so the codebase stays readable and maintainable as the number of controllers and services grows.

This is not about one service. It is the default policy for backend work.

The standard should favor:

- explicit business rules close to the code that owns them
- minimal indirection
- one final place that converts unknown failures to safe HTTP responses
- small dependency-specific helpers only when they remove repeated translation logic

We are not optimizing for elegance. We are optimizing for code that still makes sense when there are 30 services instead of 1.

## Scope

This standard applies to:

- controllers
- services
- middleware involved in validation or final error handling
- shared error helpers under `src/lib`

## Architecture

The backend error flow should stay:

`middleware/controller/service throws -> final errorHandler logs and responds`

There should be exactly one global place that turns unknown failures into a generic 500 response:

- `apps/backend/src/middleware/error-handler.ts`

Expected failures should be represented as `HttpError`.

Unexpected failures should usually throw normally and bubble up unchanged.

## Layer Rules

### Controllers

Controllers are HTTP adapters, not business-logic containers.

Controllers should:

- read request data
- call a service
- return the success response
- occasionally throw a simple `HttpError` when the failure is purely local and obvious at the HTTP boundary

Controllers should not:

- contain multi-step business logic
- translate third-party library errors
- wrap every handler in `try/catch`
- invent generic "controller failed" errors
- catch unknown errors just to rethrow a generic 500

Default controller rule:

- if a service can own the rule, keep the rule in the service

### Services

Services own business logic, domain invariants, dependency orchestration, and cross-system mutation flows.

Services should:

- throw `HttpError` for expected business failures
- keep business-state validation inline
- use local `try/catch` only when the catch adds real value

Services should not:

- hide obvious business failures behind generic helpers
- wrap every function in `try/catch`
- log every error locally
- invent fake user-facing "service failed" messages

### Middleware

Middleware owns transport-level concerns such as:

- request parsing
- request validation
- auth/session boundary checks
- upload handling
- final error translation to HTTP responses

Middleware should not absorb business-state rules that belong in services.

## Core Rules

### 1. Keep business errors inline

If the code already knows the request should fail for a normal business reason, throw `HttpError` at that point.

Examples:

- resource not found
- forbidden action
- conflicting state
- domain validation that depends on current database state

Good:

```ts
if (!user) {
  throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
}

if (context.actorUserId === userId) {
  throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'You cannot disable your own account')
}
```

Why:

- the rule stays next to the logic it protects
- future readers do not need to jump across helper layers to understand failure behavior

### 2. Do not add blanket `try/catch`

Unknown errors should normally bubble to the final error handler.

Default rule:

- no `try/catch` unless the catch has a concrete job

Bad:

```ts
try {
  return await prisma.user.findMany(...)
} catch (error) {
  throw error
}
```

### 3. A service-level `catch` is allowed only when it does real work

Valid reasons:

1. translate known third-party errors to `HttpError`
2. clean up files or external resources
3. log partial-success or compensation context the request logger cannot know
4. collapse ugly dependency-specific exceptions into one readable local path

If the catch does none of those things, remove it.

### 4. Keep translation helpers small and dependency-specific

Do not build one giant global error mapper.

Instead:

- Better Auth errors go in one Better Auth helper
- Prisma translation goes in one Prisma helper only if repeated Prisma translation actually appears
- future Stripe/S3/etc. errors get their own local helper if needed

Business rules stay inline. Dependency translation goes into a small helper only when repeated dependency behavior would otherwise make services noisy.

### 5. Dependency helpers must preserve unknown failures

The helper contract should be explicit:

- return `HttpError` for known dependency failures
- return `undefined` for unrecognized failures
- callers must rethrow the original error unchanged when the helper returns `undefined`

Good:

```ts
catch (error) {
  throw mapBetterAuthError(error) ?? error
}
```

Bad:

```ts
catch (error) {
  throw mapBetterAuthError(error) ?? new HttpError(500, ERROR_CODES.INTERNAL_SERVER_ERROR, 'Something failed')
}
```

Why:

- unknown failures should keep their original stack and log context
- only the final error handler should produce the generic 500 response

### 6. Service-level logging is rare

Do not add `logger.error` in every service catch block.

Use service-level logging only when the service knows something the request-level error log cannot know, such as:

- which mutation steps already completed
- which compensation or cleanup step failed
- external operation state that would otherwise be lost

### 7. Do not rely on `findUniqueOrThrow` for normal not-found business cases

If "record missing" is an expected business path, prefer:

- `findUnique` plus an inline `HttpError(404, ...)`

Use `findUniqueOrThrow` only when a missing record is truly unexpected at that point, or when you intentionally want it treated as an unknown failure.

Default preference in this codebase:

- explicit null check for expected business-state not-found paths

## Code Patterns

### Simple dependency translation

```ts
try {
  await auth.api.createUser(...)
} catch (error) {
  throw mapBetterAuthError(error) ?? error
}
```

### Cleanup plus translation

```ts
try {
  await auth.api.updateUser(...)
  await prisma.profile.upsert(...)
} catch (error) {
  if (avatarFile) {
    await deleteUploadedFile(avatarFile.path)
  }
  throw mapBetterAuthError(error) ?? error
}
```

### Partial-success logging plus translation

```ts
try {
  await runSeveralMutations(...)
} catch (error) {
  const mappedError = mapBetterAuthError(error)

  if (mappedError) {
    throw mappedError
  }

  logger.error({ completedMutationSteps, err: error }, 'Mutation partially succeeded before failing')
  throw error
}
```

Use this two-step pattern only when the service must preserve local operational context before rethrowing the original unknown error.

## Current Backend Decisions

- `HttpError` is the standard type for expected backend failures
- the final error middleware is the only place that converts unknown failures into generic 500 responses
- Better Auth error translation should live in `apps/backend/src/lib/errors/better-auth-errors.ts`
- business errors stay inline in services and simple controller boundary checks
- cleanup and dependency translation can live in the same local catch
- partial-success logging stays local to the specific service flow that owns that context

## Contribution Checklist

When adding a new controller or service, check these in order:

1. Is this failure an expected business rule?
2. If yes, throw `HttpError` inline.
3. If no, should the error just bubble to the final error handler?
4. If a `catch` is present, what exact job does it perform?
5. If it translates dependency errors, should that logic live in a small dependency helper?
6. If it logs locally, what information does it know that the global request log does not?

If those questions do not produce a clear reason for extra abstraction, keep the code local and explicit.

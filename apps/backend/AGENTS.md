# Backend Working Rules

## Purpose

This file captures backend implementation rules that should stay stable across future work.

For the full error-handling policy and examples, see [ERROR_HANDLING.md](./ERROR_HANDLING.md).

## Core Rules

### Controllers

Controllers are thin HTTP adapters.

They should:

- read request data and auth context
- call services
- return success responses
- only throw simple boundary-level `HttpError` when the failure is obviously local to the controller

They should not:

- own multi-step business logic
- translate library or dependency errors
- wrap handlers in blanket `try/catch`

### Services

Services own:

- business rules
- domain invariants
- multi-step mutation flows
- dependency orchestration

Services should:

- throw `HttpError` for expected business failures
- keep business-state checks inline
- use local `try/catch` only when the catch does real work

Valid service `catch` reasons:

1. dependency error translation
2. cleanup
3. partial-success logging
4. local normalization of ugly library errors

If a catch does none of those things, remove it.

### Middleware

Middleware owns:

- validation
- transport-level auth checks
- upload/parser behavior
- final error-to-response conversion

Middleware should not absorb business-state rules that belong in services.

## Stable Backend Decisions

- Keep business errors local and explicit.
- Keep unknown failures global and generic.
- Use small dependency-specific error helpers under `src/lib/errors/`.
- Do not build a global mega error registry.
- Do not add framework-like abstraction just to make code look clever.

When in doubt, prefer the most local code that keeps business behavior obvious and repeated dependency translation out of the service body.

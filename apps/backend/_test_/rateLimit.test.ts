import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import type { AuthLocals } from '../src/utils/auth-utils.js'
import { createRateLimitMiddleware } from '../src/middleware/rate-limit.js'

describe('createRateLimitMiddleware', () => {
  it('returns a 429 error after the configured request budget is exhausted', () => {
    const middleware = createRateLimitMiddleware({
      keyPrefix: 'test-rate-limit',
      max: 2,
      windowMs: 60_000,
      resolveKey: () => 'user-1',
    })

    const req = {} as Request
    const res = {
      locals: {} as AuthLocals,
    } as Response<unknown, AuthLocals>
    const next = vi.fn()

    middleware(req, res, next)
    middleware(req, res, next)
    middleware(req, res, next)

    expect(next).toHaveBeenNthCalledWith(1)
    expect(next).toHaveBeenNthCalledWith(2)
    expect(next).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        statusCode: 429,
        code: 'rate_limited',
      }),
    )
  })
})

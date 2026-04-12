import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODES } from '@repo/contracts'

import { HttpError } from '../lib/http-error.js'
import type { AuthLocals } from '../utils/auth-utils.js'

type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()

const pruneExpiredBuckets = (now: number) => {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export const createRateLimitMiddleware = ({
  keyPrefix,
  max,
  resolveKey,
  windowMs,
}: {
  keyPrefix: string
  max: number
  resolveKey: (req: Request, res: Response<unknown, AuthLocals>) => string | null | undefined
  windowMs: number
}) => {
  return (req: Request, res: Response<unknown, AuthLocals>, next: NextFunction) => {
    const resolvedKey = resolveKey(req, res)

    if (!resolvedKey) {
      next()
      return
    }

    const now = Date.now()
    pruneExpiredBuckets(now)

    const bucketKey = `${keyPrefix}:${resolvedKey}`
    const existingBucket = buckets.get(bucketKey)

    if (!existingBucket || existingBucket.resetAt <= now) {
      buckets.set(bucketKey, {
        count: 1,
        resetAt: now + windowMs,
      })
      next()
      return
    }

    if (existingBucket.count >= max) {
      next(new HttpError(429, ERROR_CODES.RATE_LIMITED, 'Too many requests'))
      return
    }

    existingBucket.count += 1
    next()
  }
}

export const authenticatedRouteRateLimit = createRateLimitMiddleware({
  keyPrefix: 'authenticated-route',
  max: 120,
  windowMs: 60_000,
  resolveKey: (_req, res) => res.locals.auth?.user.id ?? null,
})

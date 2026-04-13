import type { Request, Response } from 'express'
import { ERROR_CODES } from '@repo/contracts'
import { rateLimit } from 'express-rate-limit'

import { buildApiErrorResponse } from '../lib/api-error-response.js'
import type { AuthLocals } from '../utils/auth-utils.js'

const getIpAddress = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown'

export const createRateLimitMiddleware = ({
  max,
  keyPrefix,
  message = 'Too many requests',
  resolveKey,
  windowMs,
}: {
  keyPrefix: string
  max: number
  message?: string
  resolveKey: (req: Request, res: Response<unknown, AuthLocals>) => string
  windowMs: number
}) => {
  return rateLimit({
    limit: max,
    windowMs,
    legacyHeaders: false,
    standardHeaders: 'draft-8',
    keyGenerator: (req) => `${keyPrefix}:${resolveKey(req, req.res as Response<unknown, AuthLocals>)}`,
    handler: (req, res) => {
      res.status(429).json(buildApiErrorResponse(req, ERROR_CODES.RATE_LIMITED, message))
    },
  })
}

export const publicRouteRateLimit = createRateLimitMiddleware({
  keyPrefix: 'public-route',
  max: 120,
  windowMs: 60_000,
  resolveKey: (req) => getIpAddress(req),
})

export const authenticatedReadRateLimit = createRateLimitMiddleware({
  keyPrefix: 'authenticated-read',
  max: 180,
  windowMs: 60_000,
  resolveKey: (_req, res) => res.locals.auth?.user.id ?? getIpAddress(_req),
})

export const superadminReadRateLimit = createRateLimitMiddleware({
  keyPrefix: 'superadmin-read',
  max: 120,
  windowMs: 60_000,
  resolveKey: (req, res) => res.locals.auth?.user.id ?? getIpAddress(req),
})

export const superadminMutationRateLimit = createRateLimitMiddleware({
  keyPrefix: 'superadmin-mutation',
  max: 30,
  windowMs: 60_000,
  message: 'Too many superadmin write requests',
  resolveKey: (req, res) => res.locals.auth?.user.id ?? getIpAddress(req),
})

export const profileMutationRateLimit = createRateLimitMiddleware({
  keyPrefix: 'profile-mutation',
  max: 20,
  windowMs: 5 * 60_000,
  message: 'Too many profile updates',
  resolveKey: (req, res) => res.locals.auth?.user.id ?? getIpAddress(req),
})

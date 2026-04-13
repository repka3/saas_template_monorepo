import type { RequestHandler } from 'express'
import type { GetPublicAuthConfigResponse } from '@repo/contracts'

import { prisma } from '../lib/prisma.js'
import { env } from '../lib/env.js'

export const ping: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok' })
}

export const health: RequestHandler = (_req, res) => {
  void (async () => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.status(200).json({ status: 'ok', database: 'connected' })
    } catch {
      res.status(503).json({ status: 'degraded', database: 'unreachable' })
    }
  })()
}

export const getPublicAuthConfig: RequestHandler<never, GetPublicAuthConfigResponse> = (_req, res) => {
  res.status(200).json({
    auth: {
      signupMode: env.AUTH_SIGNUP_MODE,
      canSelfRegister: env.AUTH_SIGNUP_MODE === 'public',
    },
  })
}

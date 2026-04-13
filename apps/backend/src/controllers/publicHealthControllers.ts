import type { RequestHandler } from 'express'
import type { GetPublicAuthConfigResponse } from '@repo/contracts'

import { env } from '../lib/env.js'

export const ping: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok' })
}

export const health: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok' })
}

export const getPublicAuthConfig: RequestHandler<never, GetPublicAuthConfigResponse> = (_req, res) => {
  res.status(200).json({
    auth: {
      signupMode: env.AUTH_SIGNUP_MODE,
      canSelfRegister: env.AUTH_SIGNUP_MODE === 'public',
    },
  })
}

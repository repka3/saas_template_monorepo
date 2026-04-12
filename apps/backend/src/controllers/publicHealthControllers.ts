import type { RequestHandler } from 'express'
import type { GetPublicAuthConfigResponse } from '@repo/contracts'

import { DOMAIN_ERROR_CODES, HttpError } from '../lib/http-error.js'
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

export const testErrorController: RequestHandler = (_req, _res, next) => {
  next(
    new HttpError(500, DOMAIN_ERROR_CODES.TEST_ERROR, 'This is a test error meant to be handled by the frontend, depending on the page or situation.', {
      additionalInfo: 'This is a dummy error with additional structured information. It is mainly useful for verifying frontend error handling.',
    }),
  )
}

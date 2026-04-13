import type { NextFunction, Request, Response } from 'express'
import { ERROR_CODES, hasAuthRole } from '@repo/contracts'
import { fromNodeHeaders } from 'better-auth/node'

import type { AppRole } from '../lib/auth-schema.js'
import { auth } from '../lib/auth.js'
import { HttpError } from '../lib/http-error.js'
import { type AuthLocals, getAuthContext } from '../utils/auth-utils.js'

type AuthenticatedResponse = Response<unknown, AuthLocals>
type AuthenticatedRequestHandler = (req: Request, res: AuthenticatedResponse, next: NextFunction) => void | Promise<void>

export const requireAuthenticatedUser: AuthenticatedRequestHandler = async (req, res, next) => {
  const authContext = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })

  if (!authContext) {
    throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required')
  }

  if (authContext.user.banned === true) {
    throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'Account is disabled')
  }

  res.locals.auth = authContext
  next()
}

export const requirePasswordChangeNotRequired: AuthenticatedRequestHandler = (_req, res, next) => {
  const authContext = getAuthContext(res)

  if (authContext.user.mustChangePassword === true) {
    throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'Password change required')
  }

  next()
}

export const requireRole =
  (requiredRole: AppRole): AuthenticatedRequestHandler =>
  (_req, res, next) => {
    const authContext = getAuthContext(res)

    if (!hasAuthRole(authContext.user.role, requiredRole)) {
      const message = requiredRole === 'superadmin' ? 'Superadmin role required' : 'Required role missing'

      throw new HttpError(403, ERROR_CODES.FORBIDDEN, message)
    }

    next()
  }

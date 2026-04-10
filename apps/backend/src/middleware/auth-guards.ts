import type { NextFunction, Request, Response } from 'express'
import { fromNodeHeaders } from 'better-auth/node'

import type { SystemRole } from '../lib/auth-schema.js'
import { auth, type AuthSession } from '../lib/auth.js'
import { HttpError } from '../lib/http-error.js'

type ResolvedAuthContext = NonNullable<AuthSession>
type AuthLocals = {
  auth?: ResolvedAuthContext
}

type AuthenticatedResponse = Response<unknown, AuthLocals>
type AuthenticatedRequestHandler = (req: Request, res: AuthenticatedResponse, next: NextFunction) => void | Promise<void>

const getResolvedAuthContext = (res: AuthenticatedResponse) => res.locals.auth

export const requireAuthenticatedUser: AuthenticatedRequestHandler = async (req, res, next) => {
  try {
    const authContext = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })

    if (!authContext) {
      throw new HttpError(401, 'unauthorized', 'Authentication required')
    }

    if (authContext.user.isActive !== true) {
      throw new HttpError(403, 'forbidden', 'Account is inactive')
    }

    res.locals.auth = authContext
    next()
  } catch (error) {
    next(error)
  }
}

export const requireSystemRole =
  (requiredRole: SystemRole): AuthenticatedRequestHandler =>
  (_req, res, next) => {
    const authContext = getResolvedAuthContext(res)

    if (!authContext) {
      next(new HttpError(401, 'unauthorized', 'Authentication required'))
      return
    }

    if (authContext.user.systemRole !== requiredRole) {
      const message = requiredRole === 'SUPERADMIN' ? 'Superadmin role required' : 'Required role missing'

      next(new HttpError(403, 'forbidden', message))
      return
    }

    next()
  }

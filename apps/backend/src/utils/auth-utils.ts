import type { Response } from 'express'
import { ERROR_CODES } from '@repo/contracts'

import type { AuthSession, AuthSessionUser } from '../lib/auth.js'
import { HttpError } from '../lib/http-error.js'

export type ResolvedAuthContext = NonNullable<AuthSession>
export type AuthLocals = {
  auth?: ResolvedAuthContext
}

const getStoredAuthContext = (res: Response): ResolvedAuthContext | undefined => (res.locals as AuthLocals).auth

export const getOptionalAuthContext = (res: Response): ResolvedAuthContext | undefined => getStoredAuthContext(res)

export const getAuthContext = (res: Response): ResolvedAuthContext => {
  const authContext = getStoredAuthContext(res)

  if (!authContext) {
    throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required')
  }

  return authContext
}

export const getOptionalAuthUser = (res: Response): AuthSessionUser | undefined => getOptionalAuthContext(res)?.user

export const getAuthUser = (res: Response): AuthSessionUser => getAuthContext(res).user

export const getOptionalAuthUserId = (res: Response): string | undefined => getOptionalAuthUser(res)?.id

export const getAuthUserId = (res: Response): string => getAuthUser(res).id

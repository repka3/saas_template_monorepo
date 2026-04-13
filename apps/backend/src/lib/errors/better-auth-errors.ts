import { ERROR_CODES } from '@repo/contracts'
import { APIError } from 'better-auth'

import { HttpError } from '../http-error.js'

export const mapBetterAuthError = (error: unknown): HttpError | undefined => {
  if (!(error instanceof APIError)) {
    return undefined
  }

  const errorCode = typeof error.body?.code === 'string' ? error.body.code : undefined

  if (errorCode === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
    return new HttpError(409, ERROR_CODES.CONFLICT, 'A user with this email already exists')
  }

  if (errorCode === 'USER_NOT_FOUND') {
    return new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
  }

  return undefined
}

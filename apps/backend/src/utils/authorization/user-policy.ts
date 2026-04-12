import { ERROR_CODES, hasAuthRole } from '@repo/contracts'

import type { AuthSessionUser } from '../../lib/auth.js'
import { HttpError } from '../../lib/http-error.js'

export const assertCanReadUser = (actor: AuthSessionUser, targetUserId: string): void => {
  if (hasAuthRole(actor.role, 'superadmin') || actor.id === targetUserId) {
    return
  }

  throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'Access denied')
}

import { ERROR_CODES } from '@repo/contracts'

import type { AuthSessionUser } from '../../lib/auth.js'
import { HttpError } from '../../lib/http-error.js'

export const assertCanReadUser = (actor: AuthSessionUser, targetUserId: string): void => {
  if (actor.systemRole === 'SUPERADMIN' || actor.id === targetUserId) {
    return
  }

  throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'Access denied')
}

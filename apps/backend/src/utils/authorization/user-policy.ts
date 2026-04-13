import { ERROR_CODES, hasAuthRole } from '@repo/contracts'

import type { AuthSessionUser } from '../../lib/auth.js'
import { HttpError } from '../../lib/http-error.js'

export type UserPolicyAction = 'read' | 'update' | 'disable' | 'change-role'

export type UserPolicyActor = Pick<AuthSessionUser, 'id' | 'role'>

export type UserPolicyTarget = {
  userId: string
}

type UserPolicyContext = {
  action: UserPolicyAction
  actor: UserPolicyActor
  target: UserPolicyTarget
}

const isSelfTarget = ({ actor, target }: Pick<UserPolicyContext, 'actor' | 'target'>) => actor.id === target.userId

const isSuperadminActor = ({ actor }: Pick<UserPolicyContext, 'actor'>) => hasAuthRole(actor.role, 'superadmin')

const canReadUser = (context: UserPolicyContext) => isSuperadminActor(context) || isSelfTarget(context)

const canUpdateUser = (context: UserPolicyContext) => isSuperadminActor(context)

const canDisableUser = (context: UserPolicyContext) => isSuperadminActor(context) && !isSelfTarget(context)

const canChangeUserRole = (context: UserPolicyContext) => isSuperadminActor(context) && !isSelfTarget(context)

export const canPerformUserAction = (context: UserPolicyContext): boolean => {
  switch (context.action) {
    case 'read':
      return canReadUser(context)
    case 'update':
      return canUpdateUser(context)
    case 'disable':
      return canDisableUser(context)
    case 'change-role':
      return canChangeUserRole(context)
    default:
      return false
  }
}

const buildForbiddenMessage = (context: UserPolicyContext): string => {
  switch (context.action) {
    case 'read':
      return 'Access denied'
    case 'disable':
      return isSelfTarget(context) ? 'You cannot disable your own account' : 'Access denied'
    case 'change-role':
      return isSelfTarget(context) ? 'You cannot change your own role' : 'Access denied'
    case 'update':
    default:
      return 'Access denied'
  }
}

export const assertCanPerformUserAction = (context: UserPolicyContext): void => {
  if (canPerformUserAction(context)) {
    return
  }

  throw new HttpError(403, ERROR_CODES.FORBIDDEN, buildForbiddenMessage(context))
}

export const assertCanReadUser = (actor: UserPolicyActor, targetUserId: string): void => {
  assertCanPerformUserAction({
    action: 'read',
    actor,
    target: {
      userId: targetUserId,
    },
  })
}

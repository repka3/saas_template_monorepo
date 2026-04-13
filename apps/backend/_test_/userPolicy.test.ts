import { describe, expect, it } from 'vitest'

import { assertCanPerformUserAction } from '../src/utils/authorization/user-policy.js'

const superadminActor = {
  id: 'actor-1',
  role: 'superadmin',
} as const

const userActor = {
  id: 'actor-2',
  role: 'user',
} as const

describe('user policy', () => {
  it('allows a user to read their own record', () => {
    expect(() =>
      assertCanPerformUserAction({
        action: 'read',
        actor: userActor,
        target: {
          userId: 'actor-2',
        },
      }),
    ).not.toThrow()
  })

  it('rejects a normal user reading another user', () => {
    expect(() => {
      assertCanPerformUserAction({
        action: 'read',
        actor: userActor,
        target: {
          userId: 'actor-3',
        },
      })
    }).toThrow('Access denied')
  })

  it('rejects a superadmin from disabling themselves', () => {
    expect(() => {
      assertCanPerformUserAction({
        action: 'disable',
        actor: superadminActor,
        target: {
          userId: 'actor-1',
        },
      })
    }).toThrow('You cannot disable your own account')
  })

  it('allows a superadmin to change another user role', () => {
    expect(() =>
      assertCanPerformUserAction({
        action: 'change-role',
        actor: superadminActor,
        target: {
          userId: 'actor-3',
        },
      }),
    ).not.toThrow()
  })
})

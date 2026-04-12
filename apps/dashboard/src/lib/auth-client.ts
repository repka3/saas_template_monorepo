import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { SYSTEM_ROLES, deriveDefaultNameFromEmail, getHomePathForRole as getSharedHomePathForRole } from '@repo/contracts'
import type { SystemRole } from '@repo/contracts'

const additionalFields = {
  user: {
    systemRole: {
      type: 'string',
      input: false,
      required: true,
    },
    mustChangePassword: {
      type: 'boolean',
      input: false,
      required: true,
    },
  },
} as const

const rawApiBaseUrl = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3005'

const apiBaseUrl = rawApiBaseUrl.replace(/\/$/, '')

export const authClient = createAuthClient({
  baseURL: `${apiBaseUrl}/api/auth`,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [inferAdditionalFields(additionalFields)],
})

export type AuthSession = typeof authClient.$Infer.Session
export type AuthSessionUser = AuthSession['user']

export { SYSTEM_ROLES, deriveDefaultNameFromEmail }
export type { SystemRole }

export const getHomePathForRole = (systemRole: string | null | undefined) =>
  getSharedHomePathForRole(systemRole === 'SUPERADMIN' ? 'SUPERADMIN' : 'USER')

export const getEntryPathForUser = (
  user: Pick<AuthSessionUser, 'mustChangePassword' | 'systemRole'> | null | undefined,
) => {
  if (!user) {
    return '/login'
  }

  return user.mustChangePassword ? '/change-password' : getHomePathForRole(user.systemRole)
}

export const toAbsoluteAppUrl = (pathname: string) => new URL(pathname, window.location.origin).toString()

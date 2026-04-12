import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import { APP_ROLES, deriveDefaultNameFromEmail, getHomePathForRole as getSharedHomePathForRole, hasAuthRole, parseAuthRoles } from '@repo/contracts'
import type { AppRole } from '@repo/contracts'

const additionalFields = {
  user: {
    mustChangePassword: {
      type: 'boolean',
      input: false,
      required: true,
    },
    role: {
      type: 'string',
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

export { APP_ROLES, deriveDefaultNameFromEmail, hasAuthRole, parseAuthRoles }
export type { AppRole }

export const getHomePathForRole = (role: string | null | undefined) => getSharedHomePathForRole(role)

export const getEntryPathForUser = (
  user: Pick<AuthSessionUser, 'mustChangePassword' | 'role'> | null | undefined,
) => {
  if (!user) {
    return '/login'
  }

  return user.mustChangePassword ? '/change-password' : getHomePathForRole(user.role)
}

export const toAbsoluteAppUrl = (pathname: string) => new URL(pathname, window.location.origin).toString()

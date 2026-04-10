import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

export const SYSTEM_ROLES = ['USER', 'SUPERADMIN'] as const

export type SystemRole = (typeof SYSTEM_ROLES)[number]

const additionalFields = {
  user: {
    systemRole: {
      type: 'string',
      input: false,
      required: true,
    },
    isActive: {
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

export const getHomePathForRole = (systemRole: string | null | undefined) =>
  systemRole === 'SUPERADMIN' ? '/superadmin' : '/dashboard'

export const deriveDefaultNameFromEmail = (email: string) => {
  const localPart = email.split('@')[0]?.trim()

  if (!localPart) {
    return 'user'
  }

  return localPart.replace(/[._-]+/g, ' ').trim() || 'user'
}

export const toAbsoluteAppUrl = (pathname: string) => new URL(pathname, window.location.origin).toString()

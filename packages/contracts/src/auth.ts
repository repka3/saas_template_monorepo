export const APP_ROLES = ['user', 'superadmin'] as const

export type AppRole = (typeof APP_ROLES)[number]

const appRoleSet = new Set<string>(APP_ROLES)

export const parseAuthRoles = (role: string | null | undefined): AppRole[] => {
  if (!role) {
    return []
  }

  return role
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is AppRole => appRoleSet.has(value))
}

export const hasAuthRole = (role: string | null | undefined, requiredRole: AppRole) => parseAuthRoles(role).includes(requiredRole)

export const deriveDefaultNameFromEmail = (email: string) => {
  const localPart = email.split('@')[0]?.trim()

  if (!localPart) {
    return 'user'
  }

  return localPart.replace(/[._-]+/g, ' ').trim() || 'user'
}

export const getHomePathForRole = (role: string | null | undefined) => (hasAuthRole(role, 'superadmin') ? '/superadmin' : '/dashboard')

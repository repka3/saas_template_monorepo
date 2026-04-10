export const SYSTEM_ROLES = ['USER', 'SUPERADMIN'] as const

export type SystemRole = (typeof SYSTEM_ROLES)[number]

export const authUserAdditionalFields = {
  systemRole: {
    type: 'string',
    input: false,
    required: true,
    defaultValue: 'USER',
  },
  isActive: {
    type: 'boolean',
    input: false,
    required: true,
    defaultValue: true,
  },
} as const

export const deriveDefaultNameFromEmail = (email: string) => {
  const localPart = email.split('@')[0]?.trim()

  if (!localPart) {
    return 'user'
  }

  return localPart.replace(/[._-]+/g, ' ').trim() || 'user'
}

export const getHomePathForRole = (systemRole: SystemRole) =>
  systemRole === 'SUPERADMIN' ? '/superadmin' : '/dashboard'

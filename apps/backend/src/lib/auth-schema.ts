export { SYSTEM_ROLES, deriveDefaultNameFromEmail, getHomePathForRole } from '@repo/contracts'
export type { SystemRole } from '@repo/contracts'

export const authUserAdditionalFields = {
  systemRole: {
    type: 'string',
    input: false,
    required: true,
    defaultValue: 'USER',
  },
  mustChangePassword: {
    type: 'boolean',
    input: false,
    required: true,
    defaultValue: false,
  },
} as const

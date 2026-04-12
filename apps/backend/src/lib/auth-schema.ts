export { APP_ROLES, deriveDefaultNameFromEmail, getHomePathForRole, hasAuthRole, parseAuthRoles } from '@repo/contracts'
export type { AppRole } from '@repo/contracts'

export const authUserAdditionalFields = {
  mustChangePassword: {
    type: 'boolean',
    input: false,
    required: true,
    defaultValue: false,
  },
} as const

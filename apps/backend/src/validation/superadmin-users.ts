import { APP_ROLES } from '@repo/contracts'
import { z } from 'zod'

const trimString = z.string().transform((value) => value.trim())

const trimNullableString = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === '' ? null : value))

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? '')
    .transform((value) => (value === '' ? undefined : value)),
})

export const createUserSchema = z.object({
  email: trimString.pipe(z.string().email()),
  name: trimString.pipe(z.string().min(1)),
  firstName: trimNullableString.optional(),
  lastName: trimNullableString.optional(),
  temporaryPassword: trimString.pipe(z.string().min(12)),
  alreadyVerified: z.boolean().optional(),
})

export const updateUserParamsSchema = z.object({
  id: z.string().trim().min(1),
})

export const updateUserSchema = z
  .object({
    email: trimString.pipe(z.string().email()).optional(),
    name: trimString.pipe(z.string().min(1)).optional(),
    firstName: trimNullableString.optional(),
    lastName: trimNullableString.optional(),
    emailVerified: z.boolean().optional(),
    disabled: z.boolean().optional(),
    disableReason: trimNullableString.optional(),
    temporaryPassword: trimString.pipe(z.string().min(12)).optional(),
  })
  .superRefine((value, context) => {
    const hasAtLeastOneChange =
      value.email !== undefined ||
      value.name !== undefined ||
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.emailVerified !== undefined ||
      value.disabled !== undefined ||
      value.disableReason !== undefined ||
      value.temporaryPassword !== undefined

    if (!hasAtLeastOneChange) {
      context.addIssue({
        code: 'custom',
        message: 'Request contains no effective changes',
      })
    }

    if (value.disableReason !== undefined && value.disabled !== true) {
      context.addIssue({
        code: 'custom',
        path: ['disableReason'],
        message: 'disableReason can only be provided when disabled is true',
      })
    }
  })

export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>
export type CreateUserBodyInput = z.infer<typeof createUserSchema>
export type UpdateUserParamsInput = z.infer<typeof updateUserParamsSchema>
export type UpdateUserBodyInput = z.infer<typeof updateUserSchema>

export const updateUserRoleSchema = z.object({
  role: z.enum(APP_ROLES),
})

export type UpdateUserRoleBodyInput = z.infer<typeof updateUserRoleSchema>

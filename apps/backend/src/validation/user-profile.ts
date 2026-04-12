import { z } from 'zod'

const trimToNull = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === '' ? null : v))
  .pipe(z.string().max(100).nullable())

const booleanLike = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1')

export const updateProfileSchema = z.object({
  firstName: trimToNull.optional(),
  lastName: trimToNull.optional(),
  removeAvatar: booleanLike.optional().default(false),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

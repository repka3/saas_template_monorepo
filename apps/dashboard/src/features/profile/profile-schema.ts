import { z } from 'zod'

export const profileFormSchema = z.object({
  firstName: z.string().trim().max(100, 'Max 100 characters'),
  lastName: z.string().trim().max(100, 'Max 100 characters'),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2 MB

export function validateAvatarFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, and WebP images are accepted.'
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return 'Image must be smaller than 2 MB.'
  }
  return null
}

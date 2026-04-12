import { apiFetch } from '@/lib/api-client'

import type { UserResponse } from './profile-types'

export interface UpdateProfilePayload {
  firstName: string
  lastName: string
  avatar?: Blob | null
  removeAvatar?: boolean
}

export async function getProfile(userId: string): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/api/users/${userId}`)
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<UserResponse> {
  const fd = new FormData()
  fd.append('firstName', payload.firstName)
  fd.append('lastName', payload.lastName)

  if (payload.removeAvatar) {
    fd.append('removeAvatar', 'true')
  } else if (payload.avatar) {
    fd.append('avatar', payload.avatar, 'avatar.png')
  }

  return apiFetch<UserResponse>('/api/users/me/profile', {
    method: 'PATCH',
    body: fd,
  })
}

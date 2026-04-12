import { resolveAssetUrl } from '@/lib/api-client'

import type { UserProfile } from './profile-types'

type DisplayUser = {
  email: string
  image?: string | null
  name?: string | null
}

const normalizeNamePart = (value: string | null | undefined) => value?.trim() || ''

export function getProfileDisplayName(user: DisplayUser, profile: UserProfile | null | undefined): string {
  if (profile) {
    const profileName = [normalizeNamePart(profile.firstName), normalizeNamePart(profile.lastName)]
      .filter(Boolean)
      .join(' ')

    if (profileName) {
      return profileName
    }
  }

  return normalizeNamePart(user.name) || user.email
}

export function getProfileDisplayInitial(user: DisplayUser, profile: UserProfile | null | undefined): string {
  return getProfileDisplayName(user, profile).charAt(0).toUpperCase() || 'U'
}

export function getProfileDisplayAvatarUrl(user: DisplayUser, profile: UserProfile | null | undefined): string | null {
  void profile
  return resolveAssetUrl(user.image ?? null) ?? null
}

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { getProfile } from './profile-api'

export const profileQueryKey = (userId: string | null | undefined) => ['profile', userId] as const

export function useProfileQuery() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing authenticated user')
      }

      return getProfile(userId)
    },
    enabled: Boolean(userId),
  })
}

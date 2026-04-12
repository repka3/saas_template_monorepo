import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { updateProfile, type UpdateProfilePayload } from './profile-api'
import { profileQueryKey } from './use-profile-query'

export function useProfileMutation() {
  const { refetch, user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: async (data) => {
      if (user?.id) {
        queryClient.setQueryData(profileQueryKey(user.id), data)
      }
      await refetch()
    },
  })
}

import type { GetPublicAuthConfigResponse } from '@repo/contracts'
import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api-client'

const getPublicAuthConfig = async (): Promise<GetPublicAuthConfigResponse> => apiFetch<GetPublicAuthConfigResponse>('/api/v1/auth-config')

export const publicAuthConfigKeys = {
  all: ['public-auth-config'] as const,
}

export function usePublicAuthConfigQuery() {
  return useQuery({
    queryKey: publicAuthConfigKeys.all,
    queryFn: getPublicAuthConfig,
    staleTime: 60_000,
  })
}

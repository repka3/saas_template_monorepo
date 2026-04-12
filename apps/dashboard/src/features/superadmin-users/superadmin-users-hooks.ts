import type {
  CreateSuperadminUserResponse,
  CreateUserInput,
  GetSuperadminUserResponse,
  ListUsersQuery,
  ListUsersResponse,
  UpdateSuperadminUserResponse,
  UpdateSuperadminUserRoleResponse,
  UpdateUserInput,
  UpdateUserRoleInput,
} from '@repo/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api-client'

const buildUsersSearch = ({ page, pageSize, query }: ListUsersQuery) => {
  const params = new URLSearchParams()

  params.set('page', String(page ?? 1))
  params.set('pageSize', String(pageSize ?? 20))

  if (query) {
    params.set('query', query)
  }

  return params.toString()
}

export const superadminUsersKeys = {
  all: ['superadmin-users'] as const,
  list: (params: ListUsersQuery) => ['superadmin-users', 'list', params.page ?? 1, params.pageSize ?? 20, params.query ?? ''] as const,
  detail: (userId: string) => ['superadmin-users', 'detail', userId] as const,
}

const listSuperadminUsers = async (params: ListUsersQuery): Promise<ListUsersResponse> =>
  apiFetch<ListUsersResponse>(`/api/superadmin/users?${buildUsersSearch(params)}`)

const getSuperadminUser = async (userId: string): Promise<GetSuperadminUserResponse> =>
  apiFetch<GetSuperadminUserResponse>(`/api/superadmin/users/${userId}`)

const createSuperadminUser = async (payload: CreateUserInput): Promise<CreateSuperadminUserResponse> =>
  apiFetch<CreateSuperadminUserResponse>('/api/superadmin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

const updateSuperadminUser = async ({
  userId,
  payload,
}: {
  userId: string
  payload: UpdateUserInput
}): Promise<UpdateSuperadminUserResponse> =>
  apiFetch<UpdateSuperadminUserResponse>(`/api/superadmin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

const updateSuperadminUserRole = async ({
  userId,
  payload,
}: {
  userId: string
  payload: UpdateUserRoleInput
}): Promise<UpdateSuperadminUserRoleResponse> =>
  apiFetch<UpdateSuperadminUserRoleResponse>(`/api/superadmin/users/${userId}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

export function useSuperadminUsersQuery(params: ListUsersQuery) {
  return useQuery({
    queryKey: superadminUsersKeys.list(params),
    queryFn: () => listSuperadminUsers(params),
  })
}

export function useSuperadminUserQuery(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? superadminUsersKeys.detail(userId) : ['superadmin-users', 'detail', 'missing'],
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user ID')
      }

      return getSuperadminUser(userId)
    },
    enabled: Boolean(userId),
  })
}

export function useCreateSuperadminUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSuperadminUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: superadminUsersKeys.all })
      queryClient.setQueryData(superadminUsersKeys.detail(data.user.id), data)
    },
  })
}

export function useUpdateSuperadminUserMutation(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateUserInput) => updateSuperadminUser({ userId, payload }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: superadminUsersKeys.all })
      queryClient.setQueryData(superadminUsersKeys.detail(userId), data)
    },
  })
}

export function useUpdateSuperadminUserRoleMutation(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateUserRoleInput) => updateSuperadminUserRole({ userId, payload }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: superadminUsersKeys.all })
      queryClient.setQueryData(superadminUsersKeys.detail(userId), data)
    },
  })
}

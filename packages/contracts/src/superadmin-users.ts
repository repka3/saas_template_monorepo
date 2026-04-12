import type { AppRole } from './auth.js'

export interface SuperadminUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
  role: string
  banned: boolean
  banReason: string | null
  banExpires: string | null
  mustChangePassword: boolean
  image: string | null
  createdAt: string
  updatedAt: string
  profile: {
    firstName: string | null
    lastName: string | null
  }
}

export interface ListUsersQuery {
  page?: number
  pageSize?: number
  query?: string
}

export interface ListUsersResponse {
  users: SuperadminUser[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface GetSuperadminUserResponse {
  user: SuperadminUser
}

export interface CreateSuperadminUserResponse {
  user: SuperadminUser
}

export interface UpdateSuperadminUserResponse {
  user: SuperadminUser
}

export interface UpdateSuperadminUserRoleResponse {
  user: SuperadminUser
}

export interface CreateUserInput {
  email: string
  name: string
  firstName?: string | null
  lastName?: string | null
  temporaryPassword: string
  alreadyVerified?: boolean
}

export interface UpdateUserInput {
  email?: string
  name?: string
  firstName?: string | null
  lastName?: string | null
  emailVerified?: boolean
  disabled?: boolean
  disableReason?: string | null
  temporaryPassword?: string
}

export interface UpdateUserRoleInput {
  role: AppRole
}

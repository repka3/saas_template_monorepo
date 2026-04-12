export interface UserProfile {
  firstName: string | null
  lastName: string | null
}

export interface UserResponse {
  user: {
    id: string
    name: string | null
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: string
    updatedAt: string
    systemRole: 'USER' | 'SUPERADMIN'
    isActive: boolean
    profile: UserProfile | null
  }
}

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
    role: string
    profile: UserProfile | null
  }
}

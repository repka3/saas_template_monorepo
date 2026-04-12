import { authClient, getEntryPathForUser, getHomePathForRole } from '@/lib/auth-client'

export const useAuth = () => {
  const sessionState = authClient.useSession()
  const user = sessionState.data?.user ?? null

  return {
    ...sessionState,
    user,
    isAuthenticated: Boolean(user),
    homePath: user ? getHomePathForRole(user.systemRole) : '/login',
    entryPath: getEntryPathForUser(user),
  }
}

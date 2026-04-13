import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '@/hooks/use-auth'
import type { AppRole } from '@/lib/auth-client'
import { hasAuthRole } from '@/lib/auth-client'
import { FullScreenState } from '@/routes/route-shell'

export function RootRoute() {
  const { entryPath, isPending, user } = useAuth()

  if (isPending) {
    return <FullScreenState label="Loading session" />
  }

  return <Navigate to={user ? entryPath : '/login'} replace />
}

export function GuestOnlyRoute() {
  const { entryPath, isPending, user } = useAuth()

  if (isPending) {
    return <FullScreenState label="Loading session" />
  }

  if (user) {
    return <Navigate to={entryPath} replace />
  }

  return <Outlet />
}

export function AuthenticatedRoute({ children }: { children: ReactNode }) {
  const { isPending, user } = useAuth()

  if (isPending) {
    return <FullScreenState label="Loading workspace" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export function ProtectedRoute({ allowedRole, children }: { allowedRole: AppRole; children: ReactNode }) {
  const { homePath, isPending, user } = useAuth()

  if (isPending) {
    return <FullScreenState label="Loading workspace" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  if (!hasAuthRole(user.role, allowedRole)) {
    return <Navigate to={homePath} replace />
  }

  return <>{children}</>
}

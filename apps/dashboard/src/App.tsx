import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppErrorBoundary } from '@/routes/route-error-boundary'
import { AuthenticatedRoute, GuestOnlyRoute, ProtectedRoute, RootRoute } from '@/routes/route-guards'
import { LoginPage } from '@/features/auth/login/page'
import { RegisterRoute } from '@/features/auth/register/page'
import { ForgotPasswordPage } from '@/features/auth/forgot-password/page'
import { ResetPasswordPage } from '@/features/auth/reset-password/page'
import { VerifyEmailPage } from '@/features/auth/verify-email/page'
import { RouteLoadingState } from '@/routes/route-shell'
import SuperAdminLayout from '@/layouts/SuperAdminLayout'
import UserLayout from '@/layouts/UserLayout'

const ChangePasswordPage = lazy(() => import('@/pages/shared/ChangePasswordPage'))
const ProfilePage = lazy(() => import('@/pages/shared/ProfilePage'))
const HomeSuperadmin = lazy(() => import('@/pages/superadmin/HomeSuperadmin'))
const SuperadminUserDetailPage = lazy(() => import('@/pages/superadmin/SuperadminUserDetailPage'))
const SuperadminUsersPage = lazy(() => import('@/pages/superadmin/SuperadminUsersPage'))
const HomeUser = lazy(() => import('@/pages/user/HomeUser'))

function App() {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<RouteLoadingState />}>
        <Routes>
          <Route path="/" element={<RootRoute />} />

          <Route element={<GuestOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterRoute />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route
            path="/change-password"
            element={
              <AuthenticatedRoute>
                <ChangePasswordPage />
              </AuthenticatedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRole="user">
                <UserLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomeUser />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route
            path="/superadmin"
            element={
              <ProtectedRoute allowedRole="superadmin">
                <SuperAdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomeSuperadmin />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="users" element={<SuperadminUsersPage />} />
            <Route path="users/:id" element={<SuperadminUserDetailPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  )
}

export default App

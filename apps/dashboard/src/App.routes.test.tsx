import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const publicAuthConfigQueryMock = vi.fn()

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/features/auth/public-auth-config-hooks', () => ({
  usePublicAuthConfigQuery: () => publicAuthConfigQueryMock(),
}))

vi.mock('@/features/auth/login/page', () => ({
  LoginPage: () => <div>Login Page</div>,
}))
vi.mock('@/features/auth/register/page', () => ({
  RegisterRoute: () => <div>Register Page</div>,
}))
vi.mock('@/features/auth/forgot-password/page', () => ({
  ForgotPasswordPage: () => <div>Forgot Password Page</div>,
}))
vi.mock('@/features/auth/reset-password/page', () => ({
  ResetPasswordPage: () => <div>Reset Password Page</div>,
}))
vi.mock('@/features/auth/verify-email/page', () => ({
  VerifyEmailPage: () => <div>Verify Email Page</div>,
}))

vi.mock('@/pages/shared/ChangePasswordPage', () => ({
  default: () => <div>Change Password Page</div>,
}))

vi.mock('@/pages/shared/ProfilePage', () => ({
  default: () => <div>Profile Page</div>,
}))

vi.mock('@/pages/superadmin/HomeSuperadmin', () => ({
  default: () => <div>Superadmin Home</div>,
}))

vi.mock('@/pages/superadmin/SuperadminUsersPage', () => ({
  default: () => <div>Superadmin Users</div>,
}))

vi.mock('@/pages/superadmin/SuperadminUserDetailPage', () => ({
  default: () => <div>Superadmin User Detail</div>,
}))

vi.mock('@/pages/user/HomeUser', () => ({
  default: () => <div>User Home</div>,
}))

vi.mock('@/layouts/UserLayout', async () => {
  const { Outlet } = await import('react-router-dom')

  return {
    default: () => <Outlet />,
  }
})

vi.mock('@/layouts/SuperAdminLayout', async () => {
  const { Outlet } = await import('react-router-dom')

  return {
    default: () => <Outlet />,
  }
})

vi.mock('@/layouts/TopBar', () => ({
  default: () => <div>Top Bar</div>,
}))

import App from './App.tsx'

const renderApp = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  )

beforeEach(() => {
  useAuthMock.mockReturnValue({
    entryPath: '/login',
    homePath: '/login',
    isPending: false,
    user: null,
  })
  publicAuthConfigQueryMock.mockReturnValue({
    data: {
      auth: {
        canSelfRegister: true,
      },
    },
    isPending: false,
  })
})

describe('App routes', () => {
  it('renders the guest login route for unauthenticated users', async () => {
    renderApp('/login')

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    })
  })

  it('redirects authenticated users away from guest routes', async () => {
    useAuthMock.mockReturnValue({
      entryPath: '/dashboard',
      homePath: '/dashboard',
      isPending: false,
      user: {
        id: 'user-1',
        role: 'user',
        mustChangePassword: false,
      },
    })

    renderApp('/login')

    await waitFor(() => {
      expect(screen.getByText('User Home')).toBeInTheDocument()
    })
  })

  it('redirects unauthenticated users away from protected routes', async () => {
    renderApp('/dashboard')

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    })
  })

  it('redirects users who must change password before opening protected areas', async () => {
    useAuthMock.mockReturnValue({
      entryPath: '/change-password',
      homePath: '/dashboard',
      isPending: false,
      user: {
        id: 'user-1',
        role: 'user',
        mustChangePassword: true,
      },
    })

    renderApp('/dashboard')

    await waitFor(() => {
      expect(screen.getByText('Change Password Page')).toBeInTheDocument()
    })
  })
})

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SuperadminUsersPage from './SuperadminUsersPage.tsx'

const usersQueryMock = vi.fn()
const createMutationMock = vi.fn()

vi.mock('@/features/superadmin-users/superadmin-users-hooks', () => ({
  useSuperadminUsersQuery: (params: unknown) => usersQueryMock(params),
  useCreateSuperadminUserMutation: () => createMutationMock(),
}))

beforeEach(() => {
  usersQueryMock.mockReturnValue({
    data: {
      users: [
        {
          id: 'user-2',
          email: 'created@example.com',
          name: 'Created User',
          emailVerified: true,
          role: 'user',
          banned: false,
          banReason: null,
          banExpires: null,
          mustChangePassword: false,
          image: null,
          createdAt: '2026-04-10T12:00:00.000Z',
          updatedAt: '2026-04-10T12:00:00.000Z',
          profile: {
            firstName: 'Created',
            lastName: 'User',
          },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
  createMutationMock.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  })
})

describe('SuperadminUsersPage', () => {
  it('renders the superadmin user table and detail link', () => {
    render(
      <MemoryRouter initialEntries={['/superadmin/users?page=1&pageSize=20']}>
        <SuperadminUsersPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('Created User').length).toBeGreaterThan(0)
    expect(screen.getByText('created@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/superadmin/users/user-2')
  })
})

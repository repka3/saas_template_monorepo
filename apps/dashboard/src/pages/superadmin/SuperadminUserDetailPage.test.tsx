import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SuperadminUserDetailPage from './SuperadminUserDetailPage.tsx'

const userQueryMock = vi.fn()
const updateMutationMock = vi.fn()
const updateRoleMutationMock = vi.fn()

vi.mock('@/features/superadmin-users/superadmin-users-hooks', () => ({
  useSuperadminUserQuery: (id: string | undefined) => userQueryMock(id),
  useUpdateSuperadminUserMutation: () => updateMutationMock(),
  useUpdateSuperadminUserRoleMutation: () => updateRoleMutationMock(),
}))

beforeEach(() => {
  userQueryMock.mockReturnValue({
    data: {
      user: {
        id: 'user-2',
        email: 'created@example.com',
        name: 'Created User',
        emailVerified: true,
        role: 'superadmin',
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
    },
    isPending: false,
    isError: false,
    error: null,
  })
  updateMutationMock.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
  })
  updateRoleMutationMock.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
  })
})

describe('SuperadminUserDetailPage', () => {
  it('submits identity changes through the feature mutation', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue({})
    updateMutationMock.mockReturnValue({
      mutateAsync,
    })

    render(
      <MemoryRouter initialEntries={['/superadmin/users/user-2']}>
        <Routes>
          <Route path="/superadmin/users/:id" element={<SuperadminUserDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const emailField = screen.getByDisplayValue('created@example.com')
    await user.clear(emailField)
    await user.type(emailField, 'updated@example.com')
    await user.click(screen.getByRole('button', { name: /save identity/i }))

    expect(mutateAsync).toHaveBeenCalledWith({
      email: 'updated@example.com',
    })
  })
})

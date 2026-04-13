import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfilePage from './ProfilePage.tsx'

const profileQueryMock = vi.fn()
const profileMutationMock = vi.fn()

vi.mock('@/features/profile/use-profile-query', () => ({
  useProfileQuery: () => profileQueryMock(),
}))

vi.mock('@/features/profile/use-profile-mutation', () => ({
  useProfileMutation: () => profileMutationMock(),
}))

vi.mock('@/features/profile/profile-display', () => ({
  getProfileDisplayAvatarUrl: () => '/uploads/avatars/avatar.png',
  getProfileDisplayInitial: () => 'C',
}))

beforeEach(() => {
  profileQueryMock.mockReturnValue({
    data: {
      user: {
        email: 'created@example.com',
        image: '/uploads/avatars/avatar.png',
        profile: {
          firstName: 'Created',
          lastName: 'User',
        },
      },
    },
    error: null,
    isPending: false,
    refetch: vi.fn(),
  })
  profileMutationMock.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({}),
  })
})

describe('ProfilePage', () => {
  it('submits avatar removal and profile updates through the profile mutation', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue({})
    profileMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync,
    })

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /remove/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(mutateAsync).toHaveBeenCalledWith({
      firstName: 'Created',
      lastName: 'User',
      avatar: null,
      removeAvatar: true,
    })
  })
})

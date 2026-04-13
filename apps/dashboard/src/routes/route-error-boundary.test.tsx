import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AppErrorBoundary, SectionErrorBoundary } from './route-error-boundary.tsx'

function ThrowingComponent(): never {
  throw new Error('boom')
}

describe('route error boundaries', () => {
  it('renders the app-level fallback when a top-level route crashes', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <MemoryRouter>
        <AppErrorBoundary>
          <ThrowingComponent />
        </AppErrorBoundary>
      </MemoryRouter>,
    )

    expect(screen.getByText('App failed to render')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /return home/i })).not.toBeInTheDocument()

    consoleErrorSpy.mockRestore()
  })

  it('renders the section fallback and keeps recovery actions available', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    const { container } = render(
      <MemoryRouter>
        <SectionErrorBoundary homePath="/dashboard" scopeLabel="User section">
          <ThrowingComponent />
        </SectionErrorBoundary>
      </MemoryRouter>,
    )

    const scoped = within(container)

    expect(scoped.getByText('User section failed to render')).toBeInTheDocument()
    expect(scoped.getByRole('link', { name: /return home/i })).toHaveAttribute('href', '/dashboard')
    expect(scoped.getByRole('button', { name: /retry section/i })).toBeInTheDocument()

    await user.click(scoped.getByRole('button', { name: /retry section/i }))

    expect(scoped.getByText('User section failed to render')).toBeInTheDocument()

    consoleErrorSpy.mockRestore()
  })
})

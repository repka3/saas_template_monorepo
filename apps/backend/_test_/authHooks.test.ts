import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APIError } from 'better-auth'

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3005',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/saas_template_test',
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-thirty-two-chars',
  BETTER_AUTH_URL: 'http://localhost:3005',
  CORS_ORIGIN: 'http://localhost:5173',
  TRUST_PROXY: '2',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: 'SaaS Template <no-reply@example.test>',
  LOG_LEVEL: 'silent',
})

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}))

const { blockBannedUserBeforeSignIn, clearMustChangePasswordAfterPasswordChange } = await import('../src/lib/auth.js')

beforeEach(() => {
  prismaMock.user.findUnique.mockReset()
  prismaMock.user.findUnique.mockResolvedValue(null)
  prismaMock.user.update.mockReset()
  prismaMock.user.update.mockResolvedValue(undefined)
})

describe('blockBannedUserBeforeSignIn', () => {
  it('ignores non sign-in paths', async () => {
    await blockBannedUserBeforeSignIn({
      path: '/change-password',
      context: {},
    })

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('throws when the matched user is banned', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ banned: true })

    await expect(
      blockBannedUserBeforeSignIn({
        path: '/sign-in/email',
        body: { email: 'Blocked@example.com' },
        context: {},
      }),
    ).rejects.toBeInstanceOf(APIError)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'blocked@example.com' },
      select: { banned: true },
    })
  })
})

describe('clearMustChangePasswordAfterPasswordChange', () => {
  it('ignores unsuccessful auth responses', async () => {
    await clearMustChangePasswordAfterPasswordChange({
      path: '/change-password',
      context: {
        returned: APIError.from('BAD_REQUEST', {
          code: 'INVALID_PASSWORD',
          message: 'Invalid password',
        }),
        session: {
          user: {
            id: 'user-1',
          },
        },
      },
    })

    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('clears the flag and updates the returned auth user after successful native password change', async () => {
    const response = {
      token: null,
      user: {
        id: 'user-1',
        email: 'user@example.com',
        mustChangePassword: true,
      },
    }

    await clearMustChangePasswordAfterPasswordChange({
      path: '/change-password',
      context: {
        returned: response,
        session: {
          user: {
            id: 'user-1',
          },
        },
      },
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        mustChangePassword: false,
      },
    })
    expect(response.user.mustChangePassword).toBe(false)
  })
})

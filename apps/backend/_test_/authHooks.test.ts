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
  AUTH_SIGNUP_MODE: 'public',
  LOG_LEVEL: 'silent',
})

const prismaMock = {
  user: {
    update: vi.fn(),
  },
}

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}))

const importAuthModule = async (envOverrides?: Partial<NodeJS.ProcessEnv>) => {
  vi.resetModules()
  Object.assign(process.env, envOverrides)
  return import('../src/lib/auth.js')
}

beforeEach(() => {
  prismaMock.user.update.mockReset()
  prismaMock.user.update.mockResolvedValue(undefined)
})

describe('blockPublicSignUp', () => {
  it('ignores non sign-up paths', async () => {
    const { blockPublicSignUp } = await importAuthModule()

    await blockPublicSignUp({
      headers: new Headers(),
      path: '/change-password',
      context: {},
    })
  })

  it('allows public sign-up when signup mode is public', async () => {
    const { blockPublicSignUp } = await importAuthModule({
      AUTH_SIGNUP_MODE: 'public',
    })

    await expect(
      blockPublicSignUp({
        headers: new Headers(),
        path: '/sign-up/email',
        context: {},
      }),
    ).resolves.toBeUndefined()
  })

  it('allows the internal bootstrap seed to create the first superadmin', async () => {
    const { INTERNAL_BOOTSTRAP_SIGN_UP_HEADER, blockPublicSignUp } = await importAuthModule({
      AUTH_SIGNUP_MODE: 'admin_only',
    })

    await expect(
      blockPublicSignUp({
        headers: new Headers({
          [INTERNAL_BOOTSTRAP_SIGN_UP_HEADER]: process.env.BETTER_AUTH_SECRET!,
        }),
        path: '/sign-up/email',
        context: {},
      }),
    ).resolves.toBeUndefined()
  })

  it('blocks public sign-up when signup mode is admin_only', async () => {
    const { blockPublicSignUp } = await importAuthModule({
      AUTH_SIGNUP_MODE: 'admin_only',
    })

    await expect(
      blockPublicSignUp({
        headers: new Headers(),
        path: '/sign-up/email',
        context: {},
      }),
    ).rejects.toBeInstanceOf(APIError)
  })
})

describe('clearMustChangePasswordAfterPasswordChange', () => {
  it('ignores unsuccessful auth responses', async () => {
    const { clearMustChangePasswordAfterPasswordChange } = await importAuthModule()

    await clearMustChangePasswordAfterPasswordChange({
      headers: new Headers(),
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
    const { clearMustChangePasswordAfterPasswordChange } = await importAuthModule()

    const response = {
      token: null,
      user: {
        id: 'user-1',
        email: 'user@example.com',
        mustChangePassword: true,
      },
    }

    await clearMustChangePasswordAfterPasswordChange({
      headers: new Headers(),
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

import { describe, expect, it } from 'vitest'

const AUTH_SIGNUP_MODE_VALUES = ['public', 'admin_only'] as const

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3005',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/saas_template_test',
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-thirty-two-chars',
  BETTER_AUTH_URL: 'http://localhost:3005',
  CORS_ORIGIN: 'http://localhost:5173',
  TRUST_PROXY: '1',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: 'SaaS Template <no-reply@example.test>',
  AUTH_SIGNUP_MODE: 'public',
  LOG_LEVEL: 'silent',
}

Object.assign(process.env, validEnv)

const { parseEnv } = await import('../src/lib/env.js')

describe('parseEnv', () => {
  it('rejects missing required runtime environment variables', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        BETTER_AUTH_SECRET: undefined,
      }),
    ).toThrow(/Invalid environment variables/)
  })

  it('parses trust proxy hop counts', () => {
    const parsedEnv = parseEnv(validEnv)

    expect(parsedEnv.TRUST_PROXY).toBe(1)
  })

  it('allows trust proxy to be disabled explicitly', () => {
    const parsedEnv = parseEnv({
      ...validEnv,
      TRUST_PROXY: 'false',
    })

    expect(parsedEnv.TRUST_PROXY).toBe(false)
  })

  it('defaults signup mode to public when unset', () => {
    const parsedEnv = parseEnv({
      ...validEnv,
      AUTH_SIGNUP_MODE: undefined,
    })

    expect(parsedEnv.AUTH_SIGNUP_MODE).toBe('public')
  })

  it('accepts supported signup modes', () => {
    for (const mode of AUTH_SIGNUP_MODE_VALUES) {
      const parsedEnv = parseEnv({
        ...validEnv,
        AUTH_SIGNUP_MODE: mode,
      })

      expect(parsedEnv.AUTH_SIGNUP_MODE).toBe(mode)
    }
  })

  it('allows prisma connection limit to be unset', () => {
    const parsedEnv = parseEnv(validEnv)

    expect(parsedEnv.PRISMA_CONNECTION_LIMIT).toBeUndefined()
  })

  it('parses prisma connection limit as a positive integer', () => {
    const parsedEnv = parseEnv({
      ...validEnv,
      PRISMA_CONNECTION_LIMIT: '7',
    })

    expect(parsedEnv.PRISMA_CONNECTION_LIMIT).toBe(7)
  })

  it('rejects non-positive prisma connection limits', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        PRISMA_CONNECTION_LIMIT: '0',
      }),
    ).toThrow(/Invalid environment variables/)
  })
})

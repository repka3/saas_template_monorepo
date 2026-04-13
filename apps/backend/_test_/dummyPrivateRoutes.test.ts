import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const getSessionMock = vi.fn()

vi.mock('../src/lib/auth.js', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}))

const { app } = await import('../src/app.js')

type MockSession = {
  session: {
    id: string
    createdAt: Date
    updatedAt: Date
    userId: string
    expiresAt: Date
    token: string
    ipAddress: string | null
    userAgent: string | null
  }
  user: {
    id: string
    createdAt: Date
    updatedAt: Date
    email: string
    emailVerified: boolean
    name: string
    image: string | null
    role: 'user' | 'superadmin'
    banned: boolean
    mustChangePassword: boolean
  }
}

const buildSession = (overrides?: Partial<MockSession['user']>): MockSession => ({
  session: {
    id: 'session-1',
    createdAt: new Date('2026-04-10T12:00:00.000Z'),
    updatedAt: new Date('2026-04-10T12:00:00.000Z'),
    userId: 'user-1',
    expiresAt: new Date('2026-04-11T12:00:00.000Z'),
    token: 'token-1',
    ipAddress: null,
    userAgent: null,
  },
  user: {
    id: 'user-1',
    createdAt: new Date('2026-04-10T12:00:00.000Z'),
    updatedAt: new Date('2026-04-10T12:00:00.000Z'),
    email: 'user@example.com',
    emailVerified: true,
    name: 'Test User',
    image: null,
    role: 'user',
    banned: false,
    mustChangePassword: false,
    ...overrides,
  },
})

beforeEach(() => {
  getSessionMock.mockReset()
  getSessionMock.mockResolvedValue(null)
})

describe('dummy private routes', () => {
  it('configures trust proxy from the environment', () => {
    expect(app.get('trust proxy')).toBe(2)
  })

  it('rejects GET /api/dummy-private without a session', async () => {
    const response = await request(app).get('/api/dummy-private')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authentication required',
        requestId: expect.any(String),
      },
    })
  })

  it('rejects GET /api/dummy-superadmin without a session', async () => {
    const response = await request(app).get('/api/dummy-superadmin')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authentication required',
        requestId: expect.any(String),
      },
    })
  })

  it('allows GET /api/dummy-private for an authenticated user', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app).get('/api/dummy-private')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'ok',
      access: 'authenticated',
    })
  })

  it('rejects GET /api/dummy-superadmin for an authenticated user without the role', async () => {
    getSessionMock.mockResolvedValue(buildSession({ role: 'user' }))

    const response = await request(app).get('/api/dummy-superadmin')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: {
        code: 'forbidden',
        message: 'Superadmin role required',
        requestId: expect.any(String),
      },
    })
  })

  it('allows GET /api/dummy-superadmin for an authenticated superadmin', async () => {
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))

    const response = await request(app).get('/api/dummy-superadmin')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'ok',
      access: 'superadmin',
    })
  })

  it('rejects GET /api/dummy-private for a banned authenticated user', async () => {
    getSessionMock.mockResolvedValue(buildSession({ banned: true }))

    const response = await request(app).get('/api/dummy-private')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: {
        code: 'forbidden',
        message: 'Account is disabled',
        requestId: expect.any(String),
      },
    })
  })

  it('rejects GET /api/dummy-superadmin for a banned authenticated superadmin', async () => {
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin', banned: true }))

    const response = await request(app).get('/api/dummy-superadmin')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: {
        code: 'forbidden',
        message: 'Account is disabled',
        requestId: expect.any(String),
      },
    })
  })

  it('rejects protected routes when password change is required', async () => {
    getSessionMock.mockResolvedValue(buildSession({ mustChangePassword: true }))

    const response = await request(app).get('/api/dummy-private')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: {
        code: 'forbidden',
        message: 'Password change required',
        requestId: expect.any(String),
      },
    })
  })

  it('rejects oversized JSON payloads before route handling', async () => {
    const response = await request(app)
      .post('/api/ping')
      .send({
        payload: 'x'.repeat(120_000),
      })

    expect(response.status).toBe(413)
    expect(response.body).toEqual({
      error: {
        code: 'payload_too_large',
        message: 'Request body exceeds the configured size limit',
        requestId: expect.any(String),
      },
    })
  })

  it('returns requestId for missing routes', async () => {
    const response = await request(app).get('/api/does-not-exist')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      error: {
        code: 'not_found',
        message: 'Route not found',
        requestId: expect.any(String),
      },
    })
  })
})

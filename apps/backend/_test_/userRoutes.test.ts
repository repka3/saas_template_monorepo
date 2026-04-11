import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3007',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/saas_template_test',
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-thirty-two-chars',
  BETTER_AUTH_URL: 'http://localhost:3007',
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
const findUniqueMock = vi.fn()

vi.mock('../src/lib/auth.js', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}))

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
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
    systemRole: 'USER' | 'SUPERADMIN'
    isActive: boolean
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
    systemRole: 'USER',
    isActive: true,
    ...overrides,
  },
})

const buildDbUser = (overrides?: Record<string, unknown>) => ({
  id: 'user-1',
  name: 'Test User',
  email: 'user@example.com',
  emailVerified: true,
  systemRole: 'USER',
  isActive: true,
  image: null,
  createdAt: new Date('2026-04-10T12:00:00.000Z'),
  updatedAt: new Date('2026-04-10T12:00:00.000Z'),
  profile: {
    firstName: 'Test',
    lastName: 'User',
    avatarPath: null,
  },
  ...overrides,
})

beforeEach(() => {
  getSessionMock.mockReset()
  getSessionMock.mockResolvedValue(null)
  findUniqueMock.mockReset()
  findUniqueMock.mockResolvedValue(null)
})

describe('GET /api/users/:id', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/users/user-1')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authentication required',
        requestId: expect.any(String),
      },
    })
  })

  it('rejects a normal user requesting a different user with 403', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app).get('/api/users/other-user-id')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: {
        code: 'forbidden',
        message: 'Access denied',
        requestId: expect.any(String),
      },
    })
  })

  it('returns 404 when a normal user requests their own ID but it does not exist in DB', async () => {
    getSessionMock.mockResolvedValue(buildSession())
    findUniqueMock.mockResolvedValue(null)

    const response = await request(app).get('/api/users/user-1')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      error: {
        code: 'not_found',
        message: 'User not found',
        requestId: expect.any(String),
      },
    })
  })

  it('returns 200 with user data when a normal user requests their own ID', async () => {
    const dbUser = buildDbUser()
    getSessionMock.mockResolvedValue(buildSession())
    findUniqueMock.mockResolvedValue(dbUser)

    const response = await request(app).get('/api/users/user-1')

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      profile: {
        firstName: 'Test',
        lastName: 'User',
        avatarPath: null,
      },
    })
  })

  it('returns 200 when a superadmin requests any user', async () => {
    const dbUser = buildDbUser({ id: 'other-user', name: 'Other User' })
    getSessionMock.mockResolvedValue(buildSession({ systemRole: 'SUPERADMIN' }))
    findUniqueMock.mockResolvedValue(dbUser)

    const response = await request(app).get('/api/users/other-user')

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({
      id: 'other-user',
      name: 'Other User',
    })
  })

  it('returns 404 when a superadmin requests a non-existent user', async () => {
    getSessionMock.mockResolvedValue(buildSession({ systemRole: 'SUPERADMIN' }))
    findUniqueMock.mockResolvedValue(null)

    const response = await request(app).get('/api/users/does-not-exist')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      error: {
        code: 'not_found',
        message: 'User not found',
        requestId: expect.any(String),
      },
    })
  })
})

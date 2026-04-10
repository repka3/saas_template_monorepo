import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

beforeEach(() => {
  getSessionMock.mockReset()
  getSessionMock.mockResolvedValue(null)
})

describe('dummy private routes', () => {
  it('rejects GET /api/dummy-private without a session', async () => {
    const response = await request(app).get('/api/dummy-private')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authentication required',
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
    getSessionMock.mockResolvedValue(buildSession({ systemRole: 'USER' }))

    const response = await request(app).get('/api/dummy-superadmin')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: {
        code: 'forbidden',
        message: 'Superadmin role required',
      },
    })
  })

  it('allows GET /api/dummy-superadmin for an authenticated superadmin', async () => {
    getSessionMock.mockResolvedValue(buildSession({ systemRole: 'SUPERADMIN' }))

    const response = await request(app).get('/api/dummy-superadmin')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'ok',
      access: 'superadmin',
    })
  })

  it('rejects GET /api/dummy-private for an inactive authenticated user', async () => {
    getSessionMock.mockResolvedValue(buildSession({ isActive: false }))

    const response = await request(app).get('/api/dummy-private')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: {
        code: 'forbidden',
        message: 'Account is inactive',
      },
    })
  })

  it('rejects GET /api/dummy-superadmin for an inactive authenticated superadmin', async () => {
    getSessionMock.mockResolvedValue(buildSession({ systemRole: 'SUPERADMIN', isActive: false }))

    const response = await request(app).get('/api/dummy-superadmin')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: {
        code: 'forbidden',
        message: 'Account is inactive',
      },
    })
  })
})

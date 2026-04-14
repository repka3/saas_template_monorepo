import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3006',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/saas_template_test',
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-thirty-two-chars',
  BETTER_AUTH_URL: 'http://localhost:3006',
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

beforeEach(() => {
  getSessionMock.mockReset()
  getSessionMock.mockResolvedValue(null)
})

describe('error handling architecture', () => {
  describe('error response envelope', () => {
    it('includes requestId on all error responses', async () => {
      const response = await request(app).get('/api/v1/does-not-exist')

      expect(response.status).toBe(404)
      expect(response.body.error.requestId).toEqual(expect.any(String))
      expect(response.body.error.requestId.length).toBeGreaterThan(0)
    })

    it('uses ERROR_CODES registry codes for not_found', async () => {
      const response = await request(app).get('/api/v1/does-not-exist')

      expect(response.body.error.code).toBe('not_found')
    })

    it('uses ERROR_CODES registry codes for payload_too_large', async () => {
      const response = await request(app)
        .post('/api/v1/ping')
        .send({ payload: 'x'.repeat(120_000) })

      expect(response.status).toBe(413)
      expect(response.body.error.code).toBe('payload_too_large')
      expect(response.body.error.requestId).toEqual(expect.any(String))
    })

    it('uses ERROR_CODES registry codes for invalid JSON', async () => {
      const response = await request(app).post('/api/v1/ping').set('Content-Type', 'application/json').send('{ invalid json }')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('invalid_json')
      expect(response.body.error.requestId).toEqual(expect.any(String))
    })

    it('returns structured details from HttpError responses', async () => {
      getSessionMock.mockResolvedValue({
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
        },
      })

      const response = await request(app).patch('/api/v1/users/me/profile').set('Content-Type', 'multipart/form-data').field('removeAvatar', 'nope')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('validation_error')
      expect(response.body.error.details).toEqual(
        expect.objectContaining({
          fieldErrors: expect.objectContaining({
            removeAvatar: expect.any(Array),
          }),
        }),
      )
      expect(response.body.error.requestId).toEqual(expect.any(String))
    })

    it('uses ERROR_CODES registry codes for unauthorized', async () => {
      const response = await request(app).get('/api/v1/dummy-private')

      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('unauthorized')
    })
  })

  describe('request ID correlation', () => {
    it('echoes back a provided x-request-id', async () => {
      const traceId = 'test-trace-id-12345'
      const response = await request(app).get('/api/v1/does-not-exist').set('x-request-id', traceId)

      expect(response.body.error.requestId).toBe(traceId)
    })

    it('generates a UUID request ID when none provided', async () => {
      const response = await request(app).get('/api/v1/does-not-exist')

      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      expect(response.body.error.requestId).toMatch(uuidPattern)
    })
  })
})

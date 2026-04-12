import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

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

vi.mock('../src/lib/auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}))

const { app } = await import('../src/app.js')

describe('error handling architecture', () => {
  describe('error response envelope', () => {
    it('includes requestId on all error responses', async () => {
      const response = await request(app).get('/api/does-not-exist')

      expect(response.status).toBe(404)
      expect(response.body.error.requestId).toEqual(expect.any(String))
      expect(response.body.error.requestId.length).toBeGreaterThan(0)
    })

    it('uses ERROR_CODES registry codes for not_found', async () => {
      const response = await request(app).get('/api/does-not-exist')

      expect(response.body.error.code).toBe('not_found')
    })

    it('uses ERROR_CODES registry codes for payload_too_large', async () => {
      const response = await request(app)
        .post('/api/ping')
        .send({ payload: 'x'.repeat(120_000) })

      expect(response.status).toBe(413)
      expect(response.body.error.code).toBe('payload_too_large')
      expect(response.body.error.requestId).toEqual(expect.any(String))
    })

    it('uses ERROR_CODES registry codes for invalid JSON', async () => {
      const response = await request(app).post('/api/ping').set('Content-Type', 'application/json').send('{ invalid json }')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('invalid_json')
      expect(response.body.error.requestId).toEqual(expect.any(String))
    })

    it('returns domain error codes from HttpError', async () => {
      const response = await request(app).get('/api/test_error_500')

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('TEST_ERROR')
      expect(response.body.error.details).toEqual({
        additionalInfo: expect.any(String),
      })
      expect(response.body.error.requestId).toEqual(expect.any(String))
    })

    it('uses ERROR_CODES registry codes for unauthorized', async () => {
      const response = await request(app).get('/api/dummy-private')

      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('unauthorized')
    })
  })

  describe('request ID correlation', () => {
    it('echoes back a provided x-request-id', async () => {
      const traceId = 'test-trace-id-12345'
      const response = await request(app).get('/api/does-not-exist').set('x-request-id', traceId)

      expect(response.body.error.requestId).toBe(traceId)
    })

    it('generates a UUID request ID when none provided', async () => {
      const response = await request(app).get('/api/does-not-exist')

      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      expect(response.body.error.requestId).toMatch(uuidPattern)
    })
  })
})

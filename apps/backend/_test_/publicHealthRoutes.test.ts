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
  AUTH_SIGNUP_MODE: 'public',
  LOG_LEVEL: 'silent',
  UPLOADS_DIR: '.tmp/test-uploads-public-routes',
  MAX_AVATAR_UPLOAD_BYTES: '2097152',
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

describe('GET /api/v1/auth-config', () => {
  it('returns public auth configuration', async () => {
    const response = await request(app).get('/api/v1/auth-config')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      auth: {
        signupMode: 'public',
        canSelfRegister: true,
      },
    })
  })

  it('does not expose the old public test error route', async () => {
    const response = await request(app).get('/api/v1/test_error_500')

    expect(response.status).toBe(404)
  })
})

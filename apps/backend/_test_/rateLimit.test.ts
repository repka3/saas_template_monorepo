import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

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
  UPLOADS_DIR: '.tmp/test-uploads-rate-limit',
  MAX_AVATAR_UPLOAD_BYTES: '2097152',
})

vi.mock('../src/lib/auth.js', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}))

const { app } = await import('../src/app.js')

describe('rate limiting', () => {
  it('uses the standard express-rate-limit handler for public routes', async () => {
    let response = await request(app).get('/api/ping')

    expect(response.status).toBe(200)

    for (let index = 0; index < 119; index += 1) {
      response = await request(app).get('/api/ping')
    }

    expect(response.status).toBe(200)

    response = await request(app).get('/api/ping')

    expect(response.status).toBe(429)
    expect(response.body).toEqual({
      error: {
        code: 'rate_limited',
        message: 'Too many requests',
        requestId: expect.any(String),
      },
    })
  })
})

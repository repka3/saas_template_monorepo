import pino from 'pino'
import request from 'supertest'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: '3008',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/saas_template_test',
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-thirty-two-chars',
  BETTER_AUTH_URL: 'http://localhost:3008',
  CORS_ORIGIN: 'http://localhost:5173',
  TRUST_PROXY: '2',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: 'SaaS Template <no-reply@example.test>',
  LOG_LEVEL: 'info',
})

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('../src/lib/logger.js')
  vi.doUnmock('../src/lib/auth.js')
})

describe('request logging', () => {
  it('includes method and full url on successful automatic request logs', async () => {
    const logLines: string[] = []
    const stream = new PassThrough()

    stream.on('data', (chunk) => {
      logLines.push(chunk.toString())
    })

    vi.doMock('../src/lib/logger.js', () => ({
      logger: pino({ level: 'info', base: { service: 'backend' } }, stream),
    }))

    vi.doMock('../src/lib/auth.js', () => ({
      auth: {
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      },
    }))

    const { app } = await import('../src/app.js')

    const response = await request(app).get('/api/ping')

    expect(response.status).toBe(200)

    await new Promise((resolve) => setTimeout(resolve, 0))

    const successLog = logLines
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((line) => line.msg === 'request completed')

    expect(successLog).toMatchObject({
      method: 'GET',
      url: '/api/ping',
      statusCode: 200,
      responseTime: expect.any(Number),
      reqId: expect.any(String),
    })
  })
})

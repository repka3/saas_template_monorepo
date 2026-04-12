import { describe, expect, it } from 'vitest'

import { sanitizeForLog } from '../src/lib/logging/sanitize.js'

describe('sanitizeForLog', () => {
  it('redacts top-level sensitive keys', () => {
    const input = { username: 'alice', password: 'secret123', email: 'alice@example.com' }
    const result = sanitizeForLog(input) as Record<string, unknown>

    expect(result.username).toBe('alice')
    expect(result.password).toBe('[REDACTED]')
    expect(result.email).toBe('alice@example.com')
  })

  it('redacts case-insensitively', () => {
    const input = { Password: 'x', ACCESS_TOKEN: 'y', Authorization: 'z' }
    const result = sanitizeForLog(input) as Record<string, unknown>

    expect(result.Password).toBe('[REDACTED]')
    expect(result.ACCESS_TOKEN).toBe('[REDACTED]')
    expect(result.Authorization).toBe('[REDACTED]')
  })

  it('redacts all known sensitive patterns', () => {
    const input = {
      password: '1',
      token: '2',
      secret: '3',
      cookie: '4',
      authorization: '5',
      session: '6',
      creditcard: '7',
      ssn: '8',
      cvv: '9',
    }
    const result = sanitizeForLog(input) as Record<string, unknown>

    for (const key of Object.keys(input)) {
      expect(result[key], `expected "${key}" to be redacted`).toBe('[REDACTED]')
    }
  })

  it('redacts keys that contain sensitive substrings', () => {
    const input = { userPassword: 'x', resetToken: 'y', apiSecret: 'z' }
    const result = sanitizeForLog(input) as Record<string, unknown>

    expect(result.userPassword).toBe('[REDACTED]')
    expect(result.resetToken).toBe('[REDACTED]')
    expect(result.apiSecret).toBe('[REDACTED]')
  })

  it('recurses into nested objects', () => {
    const input = { user: { name: 'alice', credentials: { password: 'secret' } } }
    const result = sanitizeForLog(input) as Record<string, unknown>
    const user = result.user as Record<string, unknown>
    const creds = user.credentials as Record<string, unknown>

    expect(user.name).toBe('alice')
    expect(creds.password).toBe('[REDACTED]')
  })

  it('recurses into arrays', () => {
    const input = {
      users: [
        { name: 'alice', password: 'x' },
        { name: 'bob', password: 'y' },
      ],
    }
    const result = sanitizeForLog(input) as Record<string, unknown>
    const users = result.users as Record<string, unknown>[]

    expect(users[0].name).toBe('alice')
    expect(users[0].password).toBe('[REDACTED]')
    expect(users[1].name).toBe('bob')
    expect(users[1].password).toBe('[REDACTED]')
  })

  it('does not mutate the original object', () => {
    const input = { password: 'secret', name: 'alice' }
    sanitizeForLog(input)

    expect(input.password).toBe('secret')
  })

  it('depth-limits deeply nested payloads', () => {
    let obj: Record<string, unknown> = { value: 'deep' }
    for (let i = 0; i < 15; i++) {
      obj = { nested: obj }
    }

    const result = sanitizeForLog(obj)
    // Should not throw — and should cap with [DEPTH_LIMIT]
    const json = JSON.stringify(result)
    expect(json).toContain('[DEPTH_LIMIT]')
  })

  it('passes through primitives unchanged', () => {
    expect(sanitizeForLog('hello')).toBe('hello')
    expect(sanitizeForLog(42)).toBe(42)
    expect(sanitizeForLog(null)).toBeNull()
    expect(sanitizeForLog(undefined)).toBeUndefined()
    expect(sanitizeForLog(true)).toBe(true)
  })

  it('handles empty objects and arrays', () => {
    expect(sanitizeForLog({})).toEqual({})
    expect(sanitizeForLog([])).toEqual([])
  })
})

import fs from 'node:fs/promises'
import path from 'node:path'

import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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
  UPLOADS_DIR: '.tmp/test-uploads-user-routes',
  MAX_AVATAR_UPLOAD_BYTES: '2097152',
})

const getSessionMock = vi.fn()
const getUserByIdMock = vi.fn()
const updateMyProfileMock = vi.fn()

vi.mock('../src/lib/auth.js', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}))

vi.mock('../src/services/userServices.js', () => ({
  getUserById: getUserByIdMock,
  updateMyProfile: updateMyProfileMock,
  userSelect: {},
}))

const { app } = await import('../src/app.js')

const uploadsRoot = path.resolve('.tmp/test-uploads-user-routes')
const avatarUploadsDir = path.join(uploadsRoot, 'avatars')
const fixturesDir = path.resolve('.tmp/test-user-route-fixtures')
const validAvatarFixture = path.join(fixturesDir, 'avatar.png')
const invalidAvatarFixture = path.join(fixturesDir, 'avatar.txt')
const oversizedAvatarFixture = path.join(fixturesDir, 'avatar-oversized.png')

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
  },
  ...overrides,
})

const listUploadedAvatars = async (): Promise<string[]> => {
  try {
    return await fs.readdir(avatarUploadsDir)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

beforeAll(async () => {
  await fs.mkdir(fixturesDir, { recursive: true })
  await fs.writeFile(validAvatarFixture, Buffer.from('avatar-png-fixture'))
  await fs.writeFile(invalidAvatarFixture, Buffer.from('avatar-text-fixture'))
  await fs.writeFile(oversizedAvatarFixture, Buffer.alloc(2_097_153, 'a'))
})

afterAll(async () => {
  await fs.rm(fixturesDir, { recursive: true, force: true })
  await fs.rm(uploadsRoot, { recursive: true, force: true })
})

beforeEach(async () => {
  getSessionMock.mockReset()
  getSessionMock.mockResolvedValue(null)
  getUserByIdMock.mockReset()
  getUserByIdMock.mockResolvedValue(null)
  updateMyProfileMock.mockReset()
  updateMyProfileMock.mockResolvedValue(buildDbUser())
  await fs.rm(uploadsRoot, { recursive: true, force: true })
})

afterEach(async () => {
  await fs.rm(uploadsRoot, { recursive: true, force: true })
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
    getUserByIdMock.mockResolvedValue(null)

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
    getUserByIdMock.mockResolvedValue(dbUser)

    const response = await request(app).get('/api/users/user-1')

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      profile: {
        firstName: 'Test',
        lastName: 'User',
      },
    })
  })

  it('returns 200 when a superadmin requests any user', async () => {
    const dbUser = buildDbUser({ id: 'other-user', name: 'Other User' })
    getSessionMock.mockResolvedValue(buildSession({ systemRole: 'SUPERADMIN' }))
    getUserByIdMock.mockResolvedValue(dbUser)

    const response = await request(app).get('/api/users/other-user')

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({
      id: 'other-user',
      name: 'Other User',
    })
  })

  it('returns 404 when a superadmin requests a non-existent user', async () => {
    getSessionMock.mockResolvedValue(buildSession({ systemRole: 'SUPERADMIN' }))
    getUserByIdMock.mockResolvedValue(null)

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

describe('PATCH /api/users/me/profile', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app)
      .patch('/api/users/me/profile')
      .field('firstName', 'Updated')

    expect(response.status).toBe(401)
    expect(updateMyProfileMock).not.toHaveBeenCalled()
  })

  it('updates firstName and lastName for an authenticated user', async () => {
    const dbUser = buildDbUser({
      profile: {
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    })
    getSessionMock.mockResolvedValue(buildSession())
    updateMyProfileMock.mockResolvedValue(dbUser)

    const response = await request(app)
      .patch('/api/users/me/profile')
      .field('firstName', ' Ada ')
      .field('lastName', ' Lovelace ')

    expect(response.status).toBe(200)
    expect(updateMyProfileMock).toHaveBeenCalledWith('user-1', {
      input: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        removeAvatar: false,
      },
      avatarFile: undefined,
    })
    expect(response.body.user).toMatchObject({
      profile: {
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    })
  })

  it('clears firstName and lastName when empty strings are sent', async () => {
    const dbUser = buildDbUser({
      profile: {
        firstName: null,
        lastName: null,
      },
    })
    getSessionMock.mockResolvedValue(buildSession())
    updateMyProfileMock.mockResolvedValue(dbUser)

    const response = await request(app)
      .patch('/api/users/me/profile')
      .field('firstName', '   ')
      .field('lastName', '')

    expect(response.status).toBe(200)
    expect(updateMyProfileMock).toHaveBeenCalledWith('user-1', {
      input: {
        firstName: null,
        lastName: null,
        removeAvatar: false,
      },
      avatarFile: undefined,
    })
  })

  it('accepts a valid avatar upload and returns the stored avatar path', async () => {
    const dbUser = buildDbUser({
      image: '/uploads/avatars/generated-avatar.png',
      profile: {
        firstName: 'Test',
        lastName: 'User',
      },
    })
    getSessionMock.mockResolvedValue(buildSession())
    updateMyProfileMock.mockResolvedValue(dbUser)

    const response = await request(app)
      .patch('/api/users/me/profile')
      .attach('avatar', validAvatarFixture, { filename: 'avatar.png', contentType: 'image/png' })

    expect(response.status).toBe(200)
    expect(updateMyProfileMock).toHaveBeenCalledTimes(1)

    const [{ input, avatarFile }] = updateMyProfileMock.mock.calls[0].slice(1)
    expect(input).toEqual({
      removeAvatar: false,
    })
    expect(avatarFile).toMatchObject({
      fieldname: 'avatar',
      mimetype: 'image/png',
      originalname: 'avatar.png',
      filename: expect.stringMatching(/\.png$/),
      path: expect.stringContaining(path.join('test-uploads-user-routes', 'avatars')),
    })
    expect(response.body.user).toMatchObject({
      image: '/uploads/avatars/generated-avatar.png',
    })
  })

  it('stores avatar uploads under a backend-generated filename instead of the client filename', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app)
      .patch('/api/users/me/profile')
      .attach('avatar', validAvatarFixture, { filename: '../../profile-shell.png', contentType: 'image/png' })

    expect(response.status).toBe(200)
    expect(updateMyProfileMock).toHaveBeenCalledTimes(1)

    const [{ avatarFile }] = updateMyProfileMock.mock.calls[0].slice(1)
    expect(avatarFile.originalname).toBe('profile-shell.png')
    expect(avatarFile.filename).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(avatarFile.filename).not.toContain('profile-shell')

    const uploadedAvatars = await listUploadedAvatars()
    expect(uploadedAvatars).toHaveLength(1)
    expect(uploadedAvatars[0]).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(uploadedAvatars[0]).not.toContain('profile-shell')
  })

  it('returns the persisted avatar on user.image when avatar upload succeeds', async () => {
    const dbUser = buildDbUser({
      image: '/uploads/avatars/synced-avatar.webp',
      profile: {
        firstName: 'Test',
        lastName: 'User',
      },
    })
    getSessionMock.mockResolvedValue(buildSession())
    updateMyProfileMock.mockResolvedValue(dbUser)

    const response = await request(app)
      .patch('/api/users/me/profile')
      .attach('avatar', validAvatarFixture, { filename: 'avatar.webp', contentType: 'image/webp' })

    expect(response.status).toBe(200)
    expect(response.body.user.image).toBe('/uploads/avatars/synced-avatar.webp')
  })

  it('clears user.image when removeAvatar=true', async () => {
    const dbUser = buildDbUser({
      image: null,
      profile: {
        firstName: 'Test',
        lastName: 'User',
      },
    })
    getSessionMock.mockResolvedValue(buildSession())
    updateMyProfileMock.mockResolvedValue(dbUser)

    const response = await request(app)
      .patch('/api/users/me/profile')
      .field('removeAvatar', 'true')

    expect(response.status).toBe(200)
    expect(updateMyProfileMock).toHaveBeenCalledWith('user-1', {
      input: {
        removeAvatar: true,
      },
      avatarFile: undefined,
    })
    expect(response.body.user.image).toBeNull()
  })

  it('rejects requests that send both avatar and removeAvatar=true', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app)
      .patch('/api/users/me/profile')
      .field('removeAvatar', 'true')
      .attach('avatar', validAvatarFixture, { filename: 'avatar.png', contentType: 'image/png' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({
      code: 'validation_error',
      message: 'Cannot upload avatar and remove avatar in the same request',
    })
    expect(updateMyProfileMock).not.toHaveBeenCalled()
    expect(await listUploadedAvatars()).toEqual([])
  })

  it('rejects unsupported file types', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app)
      .patch('/api/users/me/profile')
      .attach('avatar', invalidAvatarFixture, { filename: 'avatar.txt', contentType: 'text/plain' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({
      code: 'validation_error',
      message: 'Unsupported avatar file type',
    })
    expect(updateMyProfileMock).not.toHaveBeenCalled()
  })

  it('rejects oversized avatar uploads', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app)
      .patch('/api/users/me/profile')
      .attach('avatar', oversizedAvatarFixture, { filename: 'avatar.png', contentType: 'image/png' })

    expect(response.status).toBe(413)
    expect(response.body.error).toMatchObject({
      code: 'payload_too_large',
      message: 'Avatar file exceeds the configured size limit',
    })
    expect(updateMyProfileMock).not.toHaveBeenCalled()
  })

  it('rejects requests with no effective changes', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app)
      .patch('/api/users/me/profile')
      .field('removeAvatar', 'false')

    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({
      code: 'validation_error',
      message: 'Request contains no effective changes',
    })
    expect(updateMyProfileMock).not.toHaveBeenCalled()
  })

  it('deletes a freshly uploaded avatar when validation fails after upload', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app)
      .patch('/api/users/me/profile')
      .field('firstName', 'x'.repeat(101))
      .attach('avatar', validAvatarFixture, { filename: 'avatar.png', contentType: 'image/png' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({
      code: 'validation_error',
      message: 'Request validation failed',
    })
    expect(updateMyProfileMock).not.toHaveBeenCalled()
    expect(await listUploadedAvatars()).toEqual([])
  })

  it('maps Multer field errors into the API error envelope', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app)
      .patch('/api/users/me/profile')
      .attach('photo', validAvatarFixture, { filename: 'avatar.png', contentType: 'image/png' })

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: {
        code: 'validation_error',
        message: 'Unexpected file upload field',
        requestId: expect.any(String),
      },
    })
    expect(updateMyProfileMock).not.toHaveBeenCalled()
  })
})

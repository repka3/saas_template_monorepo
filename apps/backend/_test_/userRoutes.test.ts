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
  AUTH_SIGNUP_MODE: 'public',
  LOG_LEVEL: 'silent',
  UPLOADS_DIR: '.tmp/test-uploads-user-routes',
  MAX_AVATAR_UPLOAD_BYTES: '2097152',
})

const getSessionMock = vi.fn()
const getUserByIdMock = vi.fn()
const getSuperadminUserByIdMock = vi.fn()
const listSuperadminUsersMock = vi.fn()
const createSuperadminUserMock = vi.fn()
const updateSuperadminUserMock = vi.fn()
const updateSuperadminUserRoleMock = vi.fn()
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
  getSuperadminUserById: getSuperadminUserByIdMock,
  listSuperadminUsers: listSuperadminUsersMock,
  createSuperadminUser: createSuperadminUserMock,
  updateSuperadminUser: updateSuperadminUserMock,
  updateSuperadminUserRole: updateSuperadminUserRoleMock,
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

const buildDbUser = (overrides?: Record<string, unknown>) => ({
  id: 'user-1',
  name: 'Test User',
  email: 'user@example.com',
  emailVerified: true,
  role: 'user',
  image: null,
  createdAt: new Date('2026-04-10T12:00:00.000Z'),
  updatedAt: new Date('2026-04-10T12:00:00.000Z'),
  profile: {
    firstName: 'Test',
    lastName: 'User',
  },
  ...overrides,
})

const buildSuperadminUser = (overrides?: Record<string, unknown>) => ({
  id: 'user-2',
  email: 'created@example.com',
  name: 'Created User',
  emailVerified: false,
  role: 'user',
  banned: false,
  banReason: null,
  banExpires: null,
  mustChangePassword: true,
  image: null,
  createdAt: '2026-04-10T12:00:00.000Z',
  updatedAt: '2026-04-10T12:00:00.000Z',
  profile: {
    firstName: 'Created',
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
  getSuperadminUserByIdMock.mockReset()
  getSuperadminUserByIdMock.mockResolvedValue(buildSuperadminUser())
  listSuperadminUsersMock.mockReset()
  listSuperadminUsersMock.mockResolvedValue({
    users: [],
    pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
  })
  createSuperadminUserMock.mockReset()
  createSuperadminUserMock.mockResolvedValue(buildSuperadminUser())
  updateSuperadminUserMock.mockReset()
  updateSuperadminUserMock.mockResolvedValue(buildSuperadminUser())
  updateSuperadminUserRoleMock.mockReset()
  updateSuperadminUserRoleMock.mockResolvedValue(buildSuperadminUser({ role: 'superadmin' }))
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
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))
    getUserByIdMock.mockResolvedValue(dbUser)

    const response = await request(app).get('/api/users/other-user')

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({
      id: 'other-user',
      name: 'Other User',
    })
  })

  it('returns 404 when a superadmin requests a non-existent user', async () => {
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))
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

describe('GET /api/superadmin/users/:id', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/superadmin/users/user-2')

    expect(response.status).toBe(401)
    expect(getSuperadminUserByIdMock).not.toHaveBeenCalled()
  })

  it('rejects authenticated non-superadmins with 403', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app).get('/api/superadmin/users/user-2')

    expect(response.status).toBe(403)
    expect(response.body.error.message).toBe('Superadmin role required')
    expect(getSuperadminUserByIdMock).not.toHaveBeenCalled()
  })

  it('returns admin detail data for superadmins', async () => {
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))
    getSuperadminUserByIdMock.mockResolvedValue(buildSuperadminUser({ banned: true }))

    const response = await request(app).get('/api/superadmin/users/user-2')

    expect(response.status).toBe(200)
    expect(getSuperadminUserByIdMock).toHaveBeenCalledWith('user-2')
    expect(response.body.user).toMatchObject({
      id: 'user-2',
      banned: true,
      mustChangePassword: true,
    })
  })
})

describe('GET /api/superadmin/users', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).get('/api/superadmin/users')

    expect(response.status).toBe(401)
    expect(listSuperadminUsersMock).not.toHaveBeenCalled()
  })

  it('rejects authenticated non-superadmins with 403', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app).get('/api/superadmin/users')

    expect(response.status).toBe(403)
    expect(response.body.error.message).toBe('Superadmin role required')
    expect(listSuperadminUsersMock).not.toHaveBeenCalled()
  })

  it('returns paginated users for superadmins and normalizes the query', async () => {
    listSuperadminUsersMock.mockResolvedValue({
      users: [buildSuperadminUser()],
      pagination: { page: 2, pageSize: 5, totalItems: 1, totalPages: 1 },
    })
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))

    const response = await request(app).get('/api/superadmin/users?page=2&pageSize=5&query=%20Ada%20')

    expect(response.status).toBe(200)
    expect(listSuperadminUsersMock).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
      query: 'Ada',
    })
    expect(response.body.pagination).toEqual({
      page: 2,
      pageSize: 5,
      totalItems: 1,
      totalPages: 1,
    })
  })
})

describe('POST /api/superadmin/users', () => {
  it('rejects authenticated non-superadmins with 403', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app).post('/api/superadmin/users').send({
      email: 'person@example.com',
      name: 'Person Example',
      temporaryPassword: 'temporary-pass',
    })

    expect(response.status).toBe(403)
    expect(createSuperadminUserMock).not.toHaveBeenCalled()
  })

  it('validates the temporary password length', async () => {
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))

    const response = await request(app).post('/api/superadmin/users').send({
      email: 'person@example.com',
      name: 'Person Example',
      temporaryPassword: 'short-pass',
    })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
    expect(createSuperadminUserMock).not.toHaveBeenCalled()
  })

  it('creates a user for a superadmin', async () => {
    createSuperadminUserMock.mockResolvedValueOnce(buildSuperadminUser({ role: 'superadmin' }))
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))

    const response = await request(app).post('/api/superadmin/users').send({
      email: 'person@example.com',
      name: ' Person Example ',
      firstName: ' Person ',
      lastName: ' Example ',
      temporaryPassword: 'temporary-pass',
      alreadyVerified: true,
      role: 'superadmin',
    })

    expect(response.status).toBe(201)
    expect(createSuperadminUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          id: 'user-1',
          role: 'superadmin',
        },
      }),
      {
        email: 'person@example.com',
        name: 'Person Example',
        firstName: 'Person',
        lastName: 'Example',
        temporaryPassword: 'temporary-pass',
        alreadyVerified: true,
        role: 'superadmin',
      },
    )
    expect(response.body.user).toMatchObject({
      email: 'created@example.com',
      role: 'superadmin',
      mustChangePassword: true,
    })
  })
})

describe('PATCH /api/superadmin/users/:id', () => {
  it('rejects self-service requests from non-superadmins', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app).patch('/api/superadmin/users/user-2').send({
      name: 'Updated User',
    })

    expect(response.status).toBe(403)
    expect(updateSuperadminUserMock).not.toHaveBeenCalled()
  })

  it('validates disableReason combinations before calling the service', async () => {
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))

    const response = await request(app).patch('/api/superadmin/users/user-2').send({
      disableReason: 'Nope',
    })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
    expect(updateSuperadminUserMock).not.toHaveBeenCalled()
  })

  it('updates a user for a superadmin', async () => {
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))

    const response = await request(app).patch('/api/superadmin/users/user-2').send({
      email: 'updated@example.com',
      firstName: ' Ada ',
      disabled: true,
      disableReason: 'Terms breach',
    })

    expect(response.status).toBe(200)
    expect(updateSuperadminUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          id: 'user-1',
          role: 'superadmin',
        },
      }),
      'user-2',
      {
        email: 'updated@example.com',
        firstName: 'Ada',
        disabled: true,
        disableReason: 'Terms breach',
      },
    )
  })

  it('returns 500 when the service throws an unexpected error after partial work', async () => {
    updateSuperadminUserMock.mockRejectedValueOnce(new Error('db write failed'))
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))

    const response = await request(app).patch('/api/superadmin/users/user-2').send({
      temporaryPassword: 'temporary-pass',
    })

    expect(response.status).toBe(500)
    expect(response.body.error.code).toBe('internal_server_error')
  })
})

describe('PATCH /api/superadmin/users/:id/role', () => {
  it('rejects authenticated non-superadmins with 403', async () => {
    getSessionMock.mockResolvedValue(buildSession())

    const response = await request(app).patch('/api/superadmin/users/user-2/role').send({
      role: 'superadmin',
    })

    expect(response.status).toBe(403)
    expect(updateSuperadminUserRoleMock).not.toHaveBeenCalled()
  })

  it('validates the requested role before calling the service', async () => {
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))

    const response = await request(app).patch('/api/superadmin/users/user-2/role').send({
      role: 'owner',
    })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
    expect(updateSuperadminUserRoleMock).not.toHaveBeenCalled()
  })

  it('updates a user role for a superadmin', async () => {
    getSessionMock.mockResolvedValue(buildSession({ role: 'superadmin' }))

    const response = await request(app).patch('/api/superadmin/users/user-2/role').send({
      role: 'superadmin',
    })

    expect(response.status).toBe(200)
    expect(updateSuperadminUserRoleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          id: 'user-1',
          role: 'superadmin',
        },
      }),
      'user-2',
      {
        role: 'superadmin',
      },
    )
    expect(response.body.user.role).toBe('superadmin')
  })
})

describe('PATCH /api/users/me/profile', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app).patch('/api/users/me/profile').field('firstName', 'Updated')

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

    const response = await request(app).patch('/api/users/me/profile').field('firstName', ' Ada ').field('lastName', ' Lovelace ')

    expect(response.status).toBe(200)
    expect(updateMyProfileMock).toHaveBeenCalledWith('user-1', {
      input: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        removeAvatar: false,
      },
      avatarFile: undefined,
      requestHeaders: expect.any(Headers),
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

    const response = await request(app).patch('/api/users/me/profile').field('firstName', '   ').field('lastName', '')

    expect(response.status).toBe(200)
    expect(updateMyProfileMock).toHaveBeenCalledWith('user-1', {
      input: {
        firstName: null,
        lastName: null,
        removeAvatar: false,
      },
      avatarFile: undefined,
      requestHeaders: expect.any(Headers),
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

    const response = await request(app).patch('/api/users/me/profile').field('removeAvatar', 'true')

    expect(response.status).toBe(200)
    expect(updateMyProfileMock).toHaveBeenCalledWith('user-1', {
      input: {
        removeAvatar: true,
      },
      avatarFile: undefined,
      requestHeaders: expect.any(Headers),
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

    const response = await request(app).patch('/api/users/me/profile').field('removeAvatar', 'false')

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

    const response = await request(app).patch('/api/users/me/profile').attach('photo', validAvatarFixture, { filename: 'avatar.png', contentType: 'image/png' })

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

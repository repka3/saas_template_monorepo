import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APIError } from 'better-auth'

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
  UPLOADS_DIR: '.tmp/test-uploads-user-services',
  MAX_AVATAR_UPLOAD_BYTES: '2097152',
})

const prismaMock = {
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  profile: {
    upsert: vi.fn(),
  },
}

const authMock = {
  api: {
    createUser: vi.fn(),
    adminUpdateUser: vi.fn(),
    setRole: vi.fn(),
    setUserPassword: vi.fn(),
    revokeUserSessions: vi.fn(),
    banUser: vi.fn(),
    unbanUser: vi.fn(),
  },
}

const loggerErrorMock = vi.fn()

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}))

vi.mock('../src/lib/auth.js', () => ({
  auth: authMock,
}))

vi.mock('../src/lib/logger.js', () => ({
  logger: {
    error: loggerErrorMock,
    warn: vi.fn(),
  },
}))

const { createSuperadminUser, listSuperadminUsers, updateSuperadminUser, updateSuperadminUserRole } = await import('../src/services/userServices.js')

const buildUserRecord = (overrides?: Record<string, unknown>) => ({
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
  createdAt: new Date('2026-04-10T12:00:00.000Z'),
  updatedAt: new Date('2026-04-10T12:00:00.000Z'),
  profile: {
    firstName: 'Created',
    lastName: 'User',
  },
  ...overrides,
})

beforeEach(() => {
  prismaMock.$transaction.mockReset()
  prismaMock.$transaction.mockImplementation(async (input: unknown) => {
    if (Array.isArray(input)) {
      return Promise.all(input)
    }

    if (typeof input === 'function') {
      return input({
        profile: {
          upsert: prismaMock.profile.upsert,
        },
        user: {
          findUniqueOrThrow: vi.fn().mockResolvedValue(buildUserRecord()),
        },
      })
    }

    return input
  })
  prismaMock.user.findUnique.mockReset()
  prismaMock.user.findUnique.mockResolvedValue(buildUserRecord())
  prismaMock.user.findUniqueOrThrow.mockReset()
  prismaMock.user.findUniqueOrThrow.mockResolvedValue(buildUserRecord())
  prismaMock.user.findMany.mockReset()
  prismaMock.user.findMany.mockResolvedValue([buildUserRecord()])
  prismaMock.user.count.mockReset()
  prismaMock.user.count.mockResolvedValue(1)
  prismaMock.profile.upsert.mockReset()
  prismaMock.profile.upsert.mockResolvedValue(undefined)
  authMock.api.createUser.mockReset()
  authMock.api.createUser.mockResolvedValue({ user: { id: 'user-2' } })
  authMock.api.adminUpdateUser.mockReset()
  authMock.api.adminUpdateUser.mockResolvedValue(buildUserRecord())
  authMock.api.setRole.mockReset()
  authMock.api.setRole.mockResolvedValue({ success: true })
  authMock.api.setUserPassword.mockReset()
  authMock.api.setUserPassword.mockResolvedValue({ status: true })
  authMock.api.revokeUserSessions.mockReset()
  authMock.api.revokeUserSessions.mockResolvedValue({ status: true })
  authMock.api.banUser.mockReset()
  authMock.api.banUser.mockResolvedValue({ user: buildUserRecord({ banned: true, banReason: 'Terms breach' }) })
  authMock.api.unbanUser.mockReset()
  authMock.api.unbanUser.mockResolvedValue({ user: buildUserRecord({ banned: false }) })
  loggerErrorMock.mockReset()
})

describe('listSuperadminUsers', () => {
  it('searches across user and profile fields and maps pagination', async () => {
    const response = await listSuperadminUsers({
      page: 2,
      pageSize: 10,
      query: 'Ada',
    })

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
        where: {
          OR: [
            { email: { contains: 'Ada', mode: 'insensitive' } },
            { name: { contains: 'Ada', mode: 'insensitive' } },
            { profile: { is: { firstName: { contains: 'Ada', mode: 'insensitive' } } } },
            { profile: { is: { lastName: { contains: 'Ada', mode: 'insensitive' } } } },
          ],
        },
      }),
    )
    expect(response).toEqual({
      users: [
        expect.objectContaining({
          email: 'created@example.com',
          createdAt: '2026-04-10T12:00:00.000Z',
        }),
      ],
      pagination: {
        page: 2,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    })
  })
})

describe('createSuperadminUser', () => {
  it('uses Better Auth createUser and creates a profile row', async () => {
    const user = await createSuperadminUser(
      {
        actor: {
          id: 'actor-1',
          role: 'superadmin',
        },
        requestHeaders: new Headers(),
      },
      {
        email: 'Created@Example.com',
        name: ' Created User ',
        firstName: 'Created',
        lastName: 'User',
        temporaryPassword: 'temporary-pass',
      },
    )

    expect(authMock.api.createUser).toHaveBeenCalledWith({
      body: {
        email: 'created@example.com',
        password: 'temporary-pass',
        name: 'Created User',
        role: 'user',
        data: {
          mustChangePassword: true,
        },
      },
      headers: expect.any(Headers),
    })
    expect(prismaMock.profile.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-2' },
      create: {
        userId: 'user-2',
        firstName: 'Created',
        lastName: 'User',
      },
      update: {
        firstName: 'Created',
        lastName: 'User',
      },
    })
    expect(user.mustChangePassword).toBe(true)
  })

  it('can create a superadmin account directly when requested by a superadmin', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUserRecord({ role: 'superadmin' }))

    await createSuperadminUser(
      {
        actor: {
          id: 'actor-1',
          role: 'superadmin',
        },
        requestHeaders: new Headers(),
      },
      {
        email: 'superadmin@example.com',
        name: 'Super Admin',
        temporaryPassword: 'temporary-pass',
        role: 'superadmin',
      },
    )

    expect(authMock.api.createUser).toHaveBeenCalledWith({
      body: expect.objectContaining({
        role: 'superadmin',
      }),
      headers: expect.any(Headers),
    })
  })

  it('maps Better Auth duplicate-email failures to 409 conflict', async () => {
    authMock.api.createUser.mockRejectedValueOnce(
      APIError.from('BAD_REQUEST', {
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'duplicate',
      }),
    )

    await expect(
      createSuperadminUser(
        {
          actor: {
            id: 'actor-1',
            role: 'superadmin',
          },
          requestHeaders: new Headers(),
        },
        {
          email: 'created@example.com',
          name: 'Created User',
          temporaryPassword: 'temporary-pass',
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'conflict',
    })
  })
})

describe('updateSuperadminUser', () => {
  it('resets emailVerified on email change, updates password state, and upserts profile', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(buildUserRecord())
    prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce(
      buildUserRecord({ email: 'updated@example.com', profile: { firstName: 'Ada', lastName: 'User' } }),
    )

    const user = await updateSuperadminUser(
      {
        actor: {
          id: 'actor-1',
          role: 'superadmin',
        },
        requestHeaders: new Headers(),
        requestId: 'req-1',
      },
      'user-2',
      {
        email: 'Updated@Example.com',
        firstName: 'Ada',
        temporaryPassword: 'temporary-pass',
      },
    )

    expect(authMock.api.adminUpdateUser).toHaveBeenCalledWith({
      body: {
        userId: 'user-2',
        data: {
          email: 'updated@example.com',
          emailVerified: false,
        },
      },
      headers: expect.any(Headers),
    })
    expect(authMock.api.setUserPassword).toHaveBeenCalledWith({
      body: {
        userId: 'user-2',
        newPassword: 'temporary-pass',
      },
      headers: expect.any(Headers),
    })
    expect(authMock.api.revokeUserSessions).toHaveBeenCalledWith({
      body: {
        userId: 'user-2',
      },
      headers: expect.any(Headers),
    })
    expect(authMock.api.adminUpdateUser).toHaveBeenNthCalledWith(2, {
      body: {
        userId: 'user-2',
        data: {
          mustChangePassword: true,
        },
      },
      headers: expect.any(Headers),
    })
    expect(prismaMock.profile.upsert).toHaveBeenCalled()
    expect(user.email).toBe('updated@example.com')
  })

  it('compensates reversible Better Auth writes when a later Prisma write fails', async () => {
    prismaMock.profile.upsert.mockRejectedValueOnce(new Error('db write failed'))

    await expect(
      updateSuperadminUser(
        {
          actor: {
            id: 'actor-1',
            role: 'superadmin',
          },
          requestHeaders: new Headers(),
          requestId: 'req-1',
        },
        'user-2',
        {
          name: 'Updated User',
          firstName: 'Ada',
        },
      ),
    ).rejects.toThrow('db write failed')

    expect(authMock.api.adminUpdateUser).toHaveBeenNthCalledWith(2, {
      body: {
        userId: 'user-2',
        data: {
          name: 'Created User',
        },
      },
      headers: expect.any(Headers),
    })
    expect(loggerErrorMock).not.toHaveBeenCalled()
  })

  it('prevents disabling the last active superadmin', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUserRecord({ id: 'user-2', role: 'superadmin', banned: false }))
    prismaMock.user.count.mockResolvedValueOnce(1)

    await expect(
      updateSuperadminUser(
        {
          actor: {
            id: 'actor-1',
            role: 'superadmin',
          },
          requestHeaders: new Headers(),
        },
        'user-2',
        {
          disabled: true,
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    })

    expect(authMock.api.banUser).not.toHaveBeenCalled()
  })
})

describe('updateSuperadminUserRole', () => {
  it('demotes a superadmin through Better Auth', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(buildUserRecord({ id: 'user-2', role: 'superadmin', banned: false }))
      .mockResolvedValueOnce(buildUserRecord({ id: 'user-2', role: 'user' }))
    prismaMock.user.count.mockResolvedValueOnce(2)

    const user = await updateSuperadminUserRole(
      {
        actor: {
          id: 'actor-1',
          role: 'superadmin',
        },
        requestHeaders: new Headers(),
      },
      'user-2',
      {
        role: 'user',
      },
    )

    expect(authMock.api.setRole).toHaveBeenCalledWith({
      body: {
        userId: 'user-2',
        role: 'user',
      },
      headers: expect.any(Headers),
    })
    expect(user.role).toBe('user')
  })

  it('rejects promoting an existing user to superadmin', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUserRecord({ id: 'user-2', role: 'user' }))

    await expect(
      updateSuperadminUserRole(
      {
        actor: {
          id: 'actor-1',
          role: 'superadmin',
        },
        requestHeaders: new Headers(),
      },
        'user-2',
        {
          role: 'superadmin',
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    })

    expect(authMock.api.setRole).not.toHaveBeenCalled()
  })

  it('prevents demoting the last active superadmin', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUserRecord({ id: 'user-2', role: 'superadmin', banned: false }))
    prismaMock.user.count.mockResolvedValueOnce(1)

    await expect(
      updateSuperadminUserRole(
      {
        actor: {
          id: 'actor-1',
          role: 'superadmin',
        },
        requestHeaders: new Headers(),
      },
        'user-2',
        {
          role: 'user',
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    })

    expect(authMock.api.setRole).not.toHaveBeenCalled()
  })
})

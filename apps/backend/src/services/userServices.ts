import fs from 'node:fs/promises'
import path from 'node:path'

import { ERROR_CODES } from '@repo/contracts'
import type { CreateUserInput, ListUsersResponse, SuperadminUser, UpdateUserInput, UpdateUserRoleInput } from '@repo/contracts'

import type { Prisma } from '../generated/prisma/client.js'
import { auth } from '../lib/auth.js'
import { mapBetterAuthError } from '../lib/errors/better-auth-errors.js'
import { HttpError } from '../lib/http-error.js'
import { logger } from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'
import { avatarDir, deleteUploadedFile } from '../middleware/upload-avatar.js'
import { isServiceOrchestrationError, runServiceOrchestration } from './service-orchestration.js'
import { assertCanPerformUserAction, type UserPolicyActor } from '../utils/authorization/user-policy.js'
import type { UpdateProfileInput } from '../validation/user-profile.js'

export const userSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  role: true,
  image: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.UserSelect

export const superadminUserSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  role: true,
  banned: true,
  banReason: true,
  banExpires: true,
  mustChangePassword: true,
  image: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.UserSelect

type SuperadminUserRecord = Prisma.UserGetPayload<{ select: typeof superadminUserSelect }>

interface SuperadminActionContext {
  actor: UserPolicyActor
  requestHeaders: Headers
  requestId?: string
}

interface UpdateMyProfileParams {
  input: UpdateProfileInput
  avatarFile?: Express.Multer.File
  requestHeaders: Headers
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const mapSuperadminUser = (user: SuperadminUserRecord): SuperadminUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  emailVerified: user.emailVerified,
  role: user.role,
  banned: user.banned ?? false,
  banReason: user.banReason ?? null,
  banExpires: user.banExpires?.toISOString() ?? null,
  mustChangePassword: user.mustChangePassword,
  image: user.image ?? null,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  profile: {
    firstName: user.profile?.firstName ?? null,
    lastName: user.profile?.lastName ?? null,
  },
})

const getSuperadminUserByIdOrNull = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: superadminUserSelect,
  })

export const getUserById = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: userSelect,
  })

export const getSuperadminUserById = async (id: string): Promise<SuperadminUser | null> => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: superadminUserSelect,
  })

  return user ? mapSuperadminUser(user) : null
}

export const listSuperadminUsers = async ({
  page = 1,
  pageSize = 20,
  query,
}: {
  page?: number
  pageSize?: number
  query?: string
}): Promise<ListUsersResponse> => {
  const trimmedQuery = query?.trim()
  const where: Prisma.UserWhereInput | undefined = trimmedQuery
    ? {
        OR: [
          { email: { contains: trimmedQuery, mode: 'insensitive' } },
          { name: { contains: trimmedQuery, mode: 'insensitive' } },
          { profile: { is: { firstName: { contains: trimmedQuery, mode: 'insensitive' } } } },
          { profile: { is: { lastName: { contains: trimmedQuery, mode: 'insensitive' } } } },
        ],
      }
    : undefined

  const skip = (page - 1) * pageSize
  const [users, totalItems] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: pageSize,
      select: superadminUserSelect,
    }),
    prisma.user.count({ where }),
  ])

  return {
    users: users.map(mapSuperadminUser),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
    },
  }
}

export const createSuperadminUser = async (context: SuperadminActionContext, input: CreateUserInput): Promise<SuperadminUser> => {
  assertCanPerformUserAction({
    action: 'update',
    actor: context.actor,
    target: {
      userId: context.actor.id,
    },
  })

  let createdUserId: string | null = null
  let createdUser: SuperadminUserRecord | null = null

  try {
    const role = input.role ?? 'user'
    await runServiceOrchestration([
      {
        name: 'auth.createUser',
        run: async () => {
          const response = await auth.api.createUser({
            body: {
              email: normalizeEmail(input.email),
              password: input.temporaryPassword,
              name: input.name.trim(),
              role,
              data: {
                mustChangePassword: true,
              },
            },
            headers: context.requestHeaders,
          })

          createdUserId = response.user.id
        },
      },
      ...(input.alreadyVerified
        ? [
            {
              name: 'auth.markEmailVerified',
              run: async () => {
                await auth.api.adminUpdateUser({
                  body: {
                    userId: createdUserId!,
                    data: {
                      emailVerified: true,
                    },
                  },
                  headers: context.requestHeaders,
                })
              },
              compensate: async () => {
                await auth.api.adminUpdateUser({
                  body: {
                    userId: createdUserId!,
                    data: {
                      emailVerified: false,
                    },
                  },
                  headers: context.requestHeaders,
                })
              },
            },
          ]
        : []),
      {
        name: 'prisma.upsertProfile',
        run: async () => {
          await prisma.profile.upsert({
            where: { userId: createdUserId! },
            create: {
              userId: createdUserId!,
              firstName: input.firstName ?? null,
              lastName: input.lastName ?? null,
            },
            update: {
              firstName: input.firstName ?? null,
              lastName: input.lastName ?? null,
            },
          })
        },
      },
      {
        name: 'prisma.reloadCreatedUser',
        run: async () => {
          createdUser = await getSuperadminUserByIdOrNull(createdUserId!)

          if (!createdUser) {
            throw new Error('Failed to reload created user')
          }
        },
      },
    ])

    return mapSuperadminUser(createdUser!)
  } catch (error) {
    const originalError = isServiceOrchestrationError(error) ? error.cause : error
    const mappedError = mapBetterAuthError(originalError)

    if (isServiceOrchestrationError(error) && (error.summary.uncompensatedSteps.length > 0 || error.summary.compensationFailures.length > 0)) {
      logger.error(
        {
          reqId: context.requestId,
          actorUserId: context.actor.id,
          targetUserId: createdUserId,
          summary: error.summary,
          err: originalError,
        },
        'Superadmin user creation partially succeeded before failing',
      )
    }

    throw mappedError ?? originalError
  }
}

export const updateSuperadminUser = async (context: SuperadminActionContext, userId: string, input: UpdateUserInput): Promise<SuperadminUser> => {
  const existingUser = await getSuperadminUserByIdOrNull(userId)

  if (!existingUser) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
  }

  assertCanPerformUserAction({
    action: input.disabled === true ? 'disable' : 'update',
    actor: context.actor,
    target: {
      userId,
    },
  })

  try {
    const nextEmail = input.email !== undefined ? normalizeEmail(input.email) : existingUser.email
    const emailChanged = nextEmail !== existingUser.email
    const nextName = input.name !== undefined ? input.name.trim() : existingUser.name
    const nameChanged = nextName !== existingUser.name
    const nextEmailVerified = input.emailVerified !== undefined ? input.emailVerified : emailChanged ? false : undefined
    const temporaryPassword = input.temporaryPassword
    const shouldUpsertProfile = input.firstName !== undefined || input.lastName !== undefined
    let user: SuperadminUserRecord | null = null

    await runServiceOrchestration([
      ...(emailChanged || nameChanged || nextEmailVerified !== undefined
        ? [
            {
              name: 'auth.adminUpdateUser.identity',
              run: async () => {
                await auth.api.adminUpdateUser({
                  body: {
                    userId,
                    data: {
                      ...(emailChanged ? { email: nextEmail } : {}),
                      ...(nameChanged ? { name: nextName } : {}),
                      ...(nextEmailVerified !== undefined ? { emailVerified: nextEmailVerified } : {}),
                    },
                  },
                  headers: context.requestHeaders,
                })
              },
              compensate: async () => {
                await auth.api.adminUpdateUser({
                  body: {
                    userId,
                    data: {
                      ...(emailChanged ? { email: existingUser.email } : {}),
                      ...(nameChanged ? { name: existingUser.name } : {}),
                      ...(nextEmailVerified !== undefined ? { emailVerified: existingUser.emailVerified } : {}),
                    },
                  },
                  headers: context.requestHeaders,
                })
              },
            },
          ]
        : []),
      ...(temporaryPassword !== undefined
        ? [
            {
              name: 'auth.setUserPassword',
              run: async () => {
                await auth.api.setUserPassword({
                  body: {
                    userId,
                    newPassword: temporaryPassword,
                  },
                  headers: context.requestHeaders,
                })
              },
            },
            {
              name: 'auth.revokeUserSessions',
              run: async () => {
                await auth.api.revokeUserSessions({
                  body: {
                    userId,
                  },
                  headers: context.requestHeaders,
                })
              },
            },
            {
              name: 'auth.requirePasswordChange',
              run: async () => {
                await auth.api.adminUpdateUser({
                  body: {
                    userId,
                    data: {
                      mustChangePassword: true,
                    },
                  },
                  headers: context.requestHeaders,
                })
              },
            },
          ]
        : []),
      ...(input.disabled === true
        ? [
            {
              name: 'auth.banUser',
              run: async () => {
                await auth.api.banUser({
                  body: {
                    userId,
                    ...(input.disableReason !== undefined && input.disableReason !== null ? { banReason: input.disableReason } : {}),
                  },
                  headers: context.requestHeaders,
                })
              },
              compensate: existingUser.banned
                ? async () => {
                    await auth.api.banUser({
                      body: {
                        userId,
                        ...(existingUser.banReason ? { banReason: existingUser.banReason } : {}),
                      },
                      headers: context.requestHeaders,
                    })
                  }
                : async () => {
                    await auth.api.unbanUser({
                      body: { userId },
                      headers: context.requestHeaders,
                    })
                  },
            },
          ]
        : []),
      ...(input.disabled === false
        ? [
            {
              name: 'auth.unbanUser',
              run: async () => {
                await auth.api.unbanUser({
                  body: { userId },
                  headers: context.requestHeaders,
                })
              },
              compensate: existingUser.banned
                ? async () => {
                    await auth.api.banUser({
                      body: {
                        userId,
                        ...(existingUser.banReason ? { banReason: existingUser.banReason } : {}),
                      },
                      headers: context.requestHeaders,
                    })
                  }
                : undefined,
            },
          ]
        : []),
      ...(shouldUpsertProfile
        ? [
            {
              name: 'prisma.upsertProfile',
              run: async () => {
                await prisma.profile.upsert({
                  where: { userId },
                  create: {
                    userId,
                    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
                    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
                  },
                  update: {
                    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
                    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
                  },
                })
              },
            },
          ]
        : []),
      {
        name: 'prisma.reloadUpdatedUser',
        run: async () => {
          user = await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: superadminUserSelect,
          })
        },
      },
    ])

    return mapSuperadminUser(user!)
  } catch (error) {
    const originalError = isServiceOrchestrationError(error) ? error.cause : error
    const mappedError = mapBetterAuthError(originalError)

    if (mappedError) {
      throw mappedError
    }

    if (isServiceOrchestrationError(error) && (error.summary.uncompensatedSteps.length > 0 || error.summary.compensationFailures.length > 0)) {
      logger.error(
        {
          reqId: context.requestId,
          actorUserId: context.actor.id,
          targetUserId: userId,
          summary: error.summary,
          err: originalError,
        },
        'Superadmin user update partially succeeded before failing',
      )
    }

    throw originalError
  }
}

export const updateSuperadminUserRole = async (context: SuperadminActionContext, userId: string, input: UpdateUserRoleInput): Promise<SuperadminUser> => {
  const existingUser = await getSuperadminUserByIdOrNull(userId)

  if (!existingUser) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
  }

  assertCanPerformUserAction({
    action: 'change-role',
    actor: context.actor,
    target: {
      userId,
    },
  })

  if (existingUser.role !== 'superadmin' && input.role === 'superadmin') {
    throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'Superadmin role can only be assigned when a superadmin creates the account')
  }

  if (existingUser.role === input.role) {
    return mapSuperadminUser(existingUser)
  }

  try {
    const previousRole = existingUser.role as UpdateUserRoleInput['role']
    let user: SuperadminUserRecord | null = null

    await runServiceOrchestration([
      {
        name: 'auth.setRole',
        run: async () => {
          await auth.api.setRole({
            body: {
              userId,
              role: input.role,
            },
            headers: context.requestHeaders,
          })
        },
        compensate: async () => {
          await auth.api.setRole({
            body: {
              userId,
              role: previousRole,
            },
            headers: context.requestHeaders,
          })
        },
      },
      {
        name: 'prisma.reloadUserAfterRoleChange',
        run: async () => {
          user = await getSuperadminUserByIdOrNull(userId)

          if (!user) {
            throw new Error('Failed to reload user after role update')
          }
        },
      },
    ])

    return mapSuperadminUser(user!)
  } catch (error) {
    const originalError = isServiceOrchestrationError(error) ? error.cause : error
    const mappedError = mapBetterAuthError(originalError)

    if (isServiceOrchestrationError(error) && (error.summary.uncompensatedSteps.length > 0 || error.summary.compensationFailures.length > 0)) {
      logger.error(
        {
          reqId: context.requestId,
          actorUserId: context.actor.id,
          targetUserId: userId,
          summary: error.summary,
          err: originalError,
        },
        'Superadmin role update partially succeeded before failing',
      )
    }

    throw mappedError ?? originalError
  }
}

const resolveAvatarDiskPath = (publicPath: string): string | null => {
  const avatarPublicPrefix = '/uploads/avatars/'

  if (!publicPath.startsWith(avatarPublicPrefix)) {
    return null
  }

  const filename = publicPath.slice(avatarPublicPrefix.length)

  if (!filename || filename.includes('/')) {
    return null
  }

  const resolved = path.resolve(avatarDir, filename)
  const relative = path.relative(avatarDir, resolved)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null
  }

  return resolved
}

const safeDeletePreviousAvatar = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath)
  } catch {
    logger.warn({ filePath }, 'Failed to delete old avatar file')
  }
}

export const updateMyProfile = async (actorUserId: string, { input, avatarFile, requestHeaders }: UpdateMyProfileParams) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { image: true },
  })

  if (!currentUser) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
  }

  const previousAvatarPath = currentUser.image ?? null

  let newAvatarPublicPath: string | null | undefined
  if (avatarFile) {
    newAvatarPublicPath = `/uploads/avatars/${avatarFile.filename}`
  } else if (input.removeAvatar) {
    newAvatarPublicPath = null
  }

  const profileData: Record<string, unknown> = {}
  if (input.firstName !== undefined) profileData.firstName = input.firstName
  if (input.lastName !== undefined) profileData.lastName = input.lastName

  let authAvatarUpdated = false

  try {
    if (newAvatarPublicPath !== undefined) {
      await auth.api.updateUser({
        body: {
          image: newAvatarPublicPath,
        },
        headers: requestHeaders,
      })

      authAvatarUpdated = true
    }

    await prisma.profile.upsert({
      where: { userId: actorUserId },
      create: { userId: actorUserId, ...profileData },
      update: profileData,
    })
  } catch (error) {
    if (authAvatarUpdated) {
      logger.error(
        {
          actorUserId,
          newAvatarPublicPath,
          avatarUploadPath: avatarFile?.path,
          err: error,
        },
        'Profile update partially succeeded before failing',
      )
    }

    if (avatarFile) {
      await deleteUploadedFile(avatarFile.path)
    }
    throw mapBetterAuthError(error) ?? error
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actorUserId },
    select: userSelect,
  })

  if (newAvatarPublicPath !== undefined && previousAvatarPath) {
    const oldDiskPath = resolveAvatarDiskPath(previousAvatarPath)
    if (oldDiskPath) {
      await safeDeletePreviousAvatar(oldDiskPath)
    }
  }

  return user
}

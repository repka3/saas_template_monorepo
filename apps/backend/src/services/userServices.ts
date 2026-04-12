import fs from 'node:fs/promises'
import path from 'node:path'

import { ERROR_CODES } from '@repo/contracts'
import type { CreateUserInput, ListUsersResponse, SuperadminUser, UpdateUserInput } from '@repo/contracts'
import { APIError } from 'better-auth'

import type { Prisma } from '../generated/prisma/client.js'
import { auth } from '../lib/auth.js'
import { HttpError } from '../lib/http-error.js'
import { logger } from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'
import { avatarDir, deleteUploadedFile } from '../middleware/upload-avatar.js'
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
  actorUserId: string
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

const mapBetterAuthError = (error: unknown): HttpError | undefined => {
  if (!(error instanceof APIError)) {
    return undefined
  }

  const errorCode = typeof error.body?.code === 'string' ? error.body.code : undefined

  if (errorCode === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
    return new HttpError(409, ERROR_CODES.CONFLICT, 'A user with this email already exists')
  }

  if (errorCode === 'USER_NOT_FOUND') {
    return new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
  }

  return undefined
}

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

export const createSuperadminUser = async (
  context: SuperadminActionContext,
  input: CreateUserInput,
): Promise<SuperadminUser> => {
  try {
    const createdUser = await auth.api.createUser({
      body: {
        email: normalizeEmail(input.email),
        password: input.temporaryPassword,
        name: input.name.trim(),
        role: 'user',
        data: {
          mustChangePassword: true,
        },
      },
      headers: context.requestHeaders,
    })

    if (input.alreadyVerified) {
      await auth.api.adminUpdateUser({
        body: {
          userId: createdUser.user.id,
          data: {
            emailVerified: true,
          },
        },
        headers: context.requestHeaders,
      })
    }

    await prisma.profile.upsert({
      where: { userId: createdUser.user.id },
      create: {
        userId: createdUser.user.id,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
      },
      update: {
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
      },
    })

    const user = await getSuperadminUserByIdOrNull(createdUser.user.id)

    if (!user) {
      throw new Error('Failed to reload created user')
    }

    return mapSuperadminUser(user)
  } catch (error) {
    throw mapBetterAuthError(error) ?? error
  }
}

export const updateSuperadminUser = async (
  context: SuperadminActionContext,
  userId: string,
  input: UpdateUserInput,
): Promise<SuperadminUser> => {
  const existingUser = await getSuperadminUserByIdOrNull(userId)

  if (!existingUser) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
  }

  if (input.disabled === true && context.actorUserId === userId) {
    throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'You cannot disable your own account')
  }

  const completedMutationSteps: string[] = []

  try {
    const nextEmail = input.email !== undefined ? normalizeEmail(input.email) : existingUser.email
    const emailChanged = nextEmail !== existingUser.email
    const nextName = input.name !== undefined ? input.name.trim() : existingUser.name
    const nameChanged = nextName !== existingUser.name
    const nextEmailVerified =
      input.emailVerified !== undefined ? input.emailVerified : emailChanged ? false : undefined

    if (emailChanged || nameChanged || nextEmailVerified !== undefined) {
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
      completedMutationSteps.push('adminUpdateUser')
    }

    if (input.temporaryPassword !== undefined) {
      await auth.api.setUserPassword({
        body: {
          userId,
          newPassword: input.temporaryPassword,
        },
        headers: context.requestHeaders,
      })
      completedMutationSteps.push('setUserPassword')

      await auth.api.revokeUserSessions({
        body: {
          userId,
        },
        headers: context.requestHeaders,
      })
      completedMutationSteps.push('revokeUserSessions')

      await auth.api.adminUpdateUser({
        body: {
          userId,
          data: {
            mustChangePassword: true,
          },
        },
        headers: context.requestHeaders,
      })
      completedMutationSteps.push('adminUpdateUser:mustChangePassword')
    }

    if (input.disabled === true) {
      await auth.api.banUser({
        body: {
          userId,
          ...(input.disableReason !== undefined && input.disableReason !== null ? { banReason: input.disableReason } : {}),
        },
        headers: context.requestHeaders,
      })
      completedMutationSteps.push('banUser')
    }

    if (input.disabled === false) {
      await auth.api.unbanUser({
        body: { userId },
        headers: context.requestHeaders,
      })
      completedMutationSteps.push('unbanUser')
    }

    const shouldUpsertProfile = input.firstName !== undefined || input.lastName !== undefined

    const user = await prisma.$transaction(async (tx) => {
      if (shouldUpsertProfile) {
        await tx.profile.upsert({
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
      }

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: superadminUserSelect,
      })
    })

    return mapSuperadminUser(user)
  } catch (error) {
    const mappedError = mapBetterAuthError(error)

    if (mappedError) {
      throw mappedError
    }

    if (completedMutationSteps.length > 0) {
      logger.error(
        {
          reqId: context.requestId,
          actorUserId: context.actorUserId,
          targetUserId: userId,
          completedMutationSteps,
          err: error,
        },
        'Superadmin user update partially succeeded before failing',
      )
    }

    throw error
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

export const updateMyProfile = async (
  actorUserId: string,
  { input, avatarFile, requestHeaders }: UpdateMyProfileParams,
) => {
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

  try {
    if (newAvatarPublicPath !== undefined) {
      await auth.api.updateUser({
        body: {
          image: newAvatarPublicPath,
        },
        headers: requestHeaders,
      })
    }

    await prisma.profile.upsert({
      where: { userId: actorUserId },
      create: { userId: actorUserId, ...profileData },
      update: profileData,
    })
  } catch (error) {
    if (avatarFile) {
      await deleteUploadedFile(avatarFile.path)
    }
    throw error
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

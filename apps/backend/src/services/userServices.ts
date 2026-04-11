import fs from 'node:fs/promises'
import path from 'node:path'

import { ERROR_CODES } from '@repo/contracts'
import type { Prisma } from '../generated/prisma/client.js'
import { HttpError } from '../lib/http-error.js'
import { logger } from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'
import { deleteUploadedFile } from '../middleware/upload-avatar.js'
import { avatarDir } from '../middleware/upload-avatar.js'
import type { UpdateProfileInput } from '../validation/user-profile.js'

export const userSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  systemRole: true,
  isActive: true,
  image: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      avatarPath: true,
    },
  },
} satisfies Prisma.UserSelect

export const getUserById = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: userSelect,
  })

interface UpdateMyProfileParams {
  input: UpdateProfileInput
  avatarFile?: Express.Multer.File
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

export const updateMyProfile = async (actorUserId: string, { input, avatarFile }: UpdateMyProfileParams) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { image: true, profile: { select: { avatarPath: true } } },
  })

  if (!currentUser) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
  }

  const previousAvatarPath = currentUser.profile?.avatarPath ?? currentUser.image ?? null

  let newAvatarPublicPath: string | null | undefined
  if (avatarFile) {
    newAvatarPublicPath = `/uploads/avatars/${avatarFile.filename}`
  } else if (input.removeAvatar) {
    newAvatarPublicPath = null
  }

  const profileData: Record<string, unknown> = {}
  if (input.firstName !== undefined) profileData.firstName = input.firstName
  if (input.lastName !== undefined) profileData.lastName = input.lastName
  if (newAvatarPublicPath !== undefined) profileData.avatarPath = newAvatarPublicPath

  const userData: Record<string, unknown> = {}
  if (newAvatarPublicPath !== undefined) userData.image = newAvatarPublicPath

  let user: Prisma.UserGetPayload<{ select: typeof userSelect }>
  try {
    user = await prisma.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { userId: actorUserId },
        create: { userId: actorUserId, ...profileData },
        update: profileData,
      })

      if (newAvatarPublicPath !== undefined) {
        return tx.user.update({
          where: { id: actorUserId },
          data: userData,
          select: userSelect,
        })
      }

      return tx.user.findUniqueOrThrow({
        where: { id: actorUserId },
        select: userSelect,
      })
    })
  } catch (error) {
    if (avatarFile) {
      await deleteUploadedFile(avatarFile.path)
    }
    throw error
  }

  // DB succeeded — clean up old avatar if it was replaced or removed
  if (newAvatarPublicPath !== undefined && previousAvatarPath) {
    const oldDiskPath = resolveAvatarDiskPath(previousAvatarPath)
    if (oldDiskPath) {
      await safeDeletePreviousAvatar(oldDiskPath)
    }
  }

  return user
}

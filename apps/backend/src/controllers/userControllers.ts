import type { RequestHandler } from 'express'
import { ERROR_CODES } from '@repo/contracts'

import { HttpError } from '../lib/http-error.js'
import { getUserById, updateMyProfile } from '../services/userServices.js'
import { assertCanReadUser } from '../utils/authorization/user-policy.js'
import { getAuthUser, getAuthUserId } from '../utils/auth-utils.js'
import type { UpdateProfileInput } from '../validation/user-profile.js'

export const getUserByIdController: RequestHandler<{ id: string }> = async (req, res) => {
  const authUser = getAuthUser(res)
  const targetId = req.params.id

  assertCanReadUser(authUser, targetId)

  const user = await getUserById(targetId)

  if (!user) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
  }

  res.status(200).json({ user })
}

export const patchMyProfileController: RequestHandler<never, { user: unknown }, UpdateProfileInput> = async (req, res) => {
  const actorUserId = getAuthUserId(res)
  const user = await updateMyProfile(actorUserId, {
    input: req.body,
    avatarFile: req.file,
  })

  res.status(200).json({ user })
}

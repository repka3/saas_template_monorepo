import type { RequestHandler } from 'express'
import type {
  CreateSuperadminUserResponse,
  CreateUserInput,
  GetSuperadminUserResponse,
  ListUsersQuery,
  UpdateSuperadminUserResponse,
  UpdateUserInput,
  UpdateSuperadminUserRoleResponse,
  UpdateUserRoleInput,
} from '@repo/contracts'
import { ERROR_CODES } from '@repo/contracts'
import { fromNodeHeaders } from 'better-auth/node'

import { HttpError } from '../lib/http-error.js'
import {
  createSuperadminUser,
  getSuperadminUserById,
  getUserById,
  listSuperadminUsers,
  updateMyProfile,
  updateSuperadminUser,
  updateSuperadminUserRole,
} from '../services/userServices.js'
import { assertCanReadUser } from '../utils/authorization/user-policy.js'
import { getAuthUser, getAuthUserId } from '../utils/auth-utils.js'
import type { UpdateProfileInput } from '../validation/user-profile.js'
import type { CreateUserBodyInput, UpdateUserBodyInput, UpdateUserParamsInput, UpdateUserRoleBodyInput } from '../validation/superadmin-users.js'

export const listUsersController: RequestHandler = async (req, res) => {
  const response = await listSuperadminUsers(req.query as ListUsersQuery)

  res.status(200).json(response)
}

export const createUserController: RequestHandler<never, CreateSuperadminUserResponse, CreateUserBodyInput> = async (req, res) => {
  const actorUserId = getAuthUserId(res)
  const user = await createSuperadminUser(
    {
      actorUserId,
      requestHeaders: fromNodeHeaders(req.headers),
    },
    req.body as CreateUserInput,
  )

  res.status(201).json({ user })
}

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

export const getSuperadminUserByIdController: RequestHandler<{ id: string }, GetSuperadminUserResponse> = async (req, res) => {
  const user = await getSuperadminUserById(req.params.id)

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
    requestHeaders: fromNodeHeaders(req.headers),
  })

  res.status(200).json({ user })
}

export const updateUserController: RequestHandler<UpdateUserParamsInput, UpdateSuperadminUserResponse, UpdateUserBodyInput> = async (req, res) => {
  const actorUserId = getAuthUserId(res)
  const user = await updateSuperadminUser(
    {
      actorUserId,
      requestHeaders: fromNodeHeaders(req.headers),
      requestId: req.id !== undefined ? String(req.id) : undefined,
    },
    req.params.id,
    req.body as UpdateUserInput,
  )

  res.status(200).json({ user })
}

export const updateUserRoleController: RequestHandler<UpdateUserParamsInput, UpdateSuperadminUserRoleResponse, UpdateUserRoleBodyInput> = async (req, res) => {
  const actorUserId = getAuthUserId(res)
  const user = await updateSuperadminUserRole(
    {
      actorUserId,
      requestHeaders: fromNodeHeaders(req.headers),
      requestId: req.id !== undefined ? String(req.id) : undefined,
    },
    req.params.id,
    req.body as UpdateUserRoleInput,
  )

  res.status(200).json({ user })
}

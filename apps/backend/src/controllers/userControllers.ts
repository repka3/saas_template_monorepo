import type { RequestHandler } from 'express'
import { ERROR_CODES } from '@repo/contracts'

import { HttpError } from '../lib/http-error.js'
import { getUserById } from '../services/userServices.js'

export const getUserByIdController: RequestHandler<{ id: string }> = async (req, res) => {
  const authUser = (res.locals as Record<string, any>).auth.user
  const targetId = req.params.id

  if (authUser.systemRole !== 'SUPERADMIN' && authUser.id !== targetId) {
    throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'Access denied')
  }

  const user = await getUserById(targetId)

  if (!user) {
    throw new HttpError(404, ERROR_CODES.NOT_FOUND, 'User not found')
  }

  res.status(200).json({ user })
}

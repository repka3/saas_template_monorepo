import type { RequestHandler } from 'express'
import { ERROR_CODES } from '@repo/contracts'
import { ZodError } from 'zod'

import { HttpError } from '../lib/http-error.js'
import { updateProfileSchema } from '../validation/user-profile.js'
import { deleteUploadedFile } from './upload-avatar.js'

export const validateProfileUpdate: RequestHandler = async (req, _res, next) => {
  const cleanup = async () => {
    if (req.file) {
      await deleteUploadedFile(req.file.path)
    }
  }

  try {
    if (!req.is('multipart/form-data')) {
      throw new HttpError(400, ERROR_CODES.VALIDATION_ERROR, 'Content-Type must be multipart/form-data')
    }

    const parsed = updateProfileSchema.parse(req.body)
    req.body = parsed

    const hasFile = !!req.file
    const hasTextFields = parsed.firstName !== undefined || parsed.lastName !== undefined
    const isRemovingAvatar = parsed.removeAvatar === true

    if (hasFile && isRemovingAvatar) {
      await cleanup()
      throw new HttpError(400, ERROR_CODES.VALIDATION_ERROR, 'Cannot upload avatar and remove avatar in the same request')
    }

    if (!hasFile && !hasTextFields && !isRemovingAvatar) {
      await cleanup()
      throw new HttpError(400, ERROR_CODES.VALIDATION_ERROR, 'Request contains no effective changes')
    }

    next()
  } catch (error) {
    await cleanup()

    if (error instanceof ZodError) {
      next(
        new HttpError(400, ERROR_CODES.VALIDATION_ERROR, 'Request validation failed', error.flatten() as Record<string, unknown>),
      )
      return
    }

    next(error)
  }
}

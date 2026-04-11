import type { Request } from 'express'
import type { ApiErrorResponse } from '@repo/contracts'

import type { HttpErrorCode } from './http-error.js'

export const buildApiErrorResponse = (req: Request, code: HttpErrorCode, message: string, details?: Record<string, unknown>): ApiErrorResponse => {
  const response: ApiErrorResponse = {
    error: {
      code,
      message,
    },
  }

  if (details !== undefined) {
    response.error.details = details
  }

  if (req.id !== undefined) {
    response.error.requestId = String(req.id)
  }

  return response
}

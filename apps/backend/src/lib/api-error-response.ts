import type { Request } from 'express'
import type { ApiErrorResponse } from '@repo/contracts'

export const buildApiErrorResponse = (req: Request, code: string, message: string, details?: unknown): ApiErrorResponse => {
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

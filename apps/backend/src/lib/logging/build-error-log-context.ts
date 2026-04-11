import type { Request, Response } from 'express'

import { sanitizeForLog } from './sanitize.js'
import { getOptionalAuthUserId } from '../../utils/auth-utils.js'

const getOptionalSanitizedBody = (req: Request, res: Response): unknown => {
  if (!(res.locals as Record<string, unknown>).logBody) return undefined
  if (req.body === undefined || req.body === null) return undefined
  return sanitizeForLog(req.body)
}

const normalizeErrorMeta = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: 'code' in error ? (error as { code: unknown }).code : undefined,
      statusCode: 'statusCode' in error ? (error as { statusCode: unknown }).statusCode : undefined,
      stack: error.stack,
    }
  }

  return { name: 'UnknownError', message: String(error) }
}

export const buildErrorLogContext = (req: Request, res: Response, error: unknown) => ({
  reqId: req.id,
  method: req.method,
  url: req.originalUrl,
  params: req.params,
  query: req.query,
  body: getOptionalSanitizedBody(req, res),
  userId: getOptionalAuthUserId(res),
  error: normalizeErrorMeta(error),
})

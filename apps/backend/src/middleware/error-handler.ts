import type { ErrorRequestHandler } from 'express'
import { ERROR_CODES } from '@repo/contracts'
import { ZodError } from 'zod'

import { buildApiErrorResponse } from '../lib/api-error-response.js'
import { HttpError } from '../lib/http-error.js'
import { buildErrorLogContext } from '../lib/logging/build-error-log-context.js'
import { logger } from '../lib/logger.js'

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  void _next
  const requestLogger = req.log ?? logger
  const statusCode = error instanceof HttpError ? error.statusCode : 500
  const logLevel = statusCode < 500 ? 'warn' : 'error'

  requestLogger[logLevel](buildErrorLogContext(req, res, error), 'request errored')

  if (error instanceof HttpError) {
    res.status(error.statusCode).json(buildApiErrorResponse(req, error.code, error.message, error.details))
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json(
      buildApiErrorResponse(req, ERROR_CODES.VALIDATION_ERROR, 'Request validation failed', error.flatten() as Record<string, unknown>),
    )
    return
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json(buildApiErrorResponse(req, ERROR_CODES.INVALID_JSON, 'Request body contains invalid JSON'))
    return
  }

  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json(buildApiErrorResponse(req, ERROR_CODES.PAYLOAD_TOO_LARGE, 'Request body exceeds the configured size limit'))
    return
  }

  res.status(500).json(buildApiErrorResponse(req, ERROR_CODES.INTERNAL_SERVER_ERROR, 'An unexpected error occurred'))
}

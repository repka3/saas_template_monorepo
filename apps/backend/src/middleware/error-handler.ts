import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

import { buildApiErrorResponse } from '../lib/api-error-response.js'
import { HttpError } from '../lib/http-error.js'
import { logger } from '../lib/logger.js'

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  void _next
  const requestLogger = req.log ?? logger

  requestLogger.error({ err: error }, 'request failed')

  if (error instanceof HttpError) {
    res.status(error.statusCode).json(buildApiErrorResponse(req, error.code, error.message, error.details))
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json(buildApiErrorResponse(req, 'validation_error', 'Request validation failed', error.flatten()))
    return
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json(buildApiErrorResponse(req, 'invalid_json', 'Request body contains invalid JSON'))
    return
  }

  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json(buildApiErrorResponse(req, 'payload_too_large', 'Request body exceeds the configured size limit'))
    return
  }

  res.status(500).json(buildApiErrorResponse(req, 'internal_server_error', 'An unexpected error occurred'))
}

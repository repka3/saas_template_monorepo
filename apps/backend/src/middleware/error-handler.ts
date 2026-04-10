import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

import { HttpError } from '../lib/http-error.js'
import { logger } from '../lib/logger.js'

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  void _next
  const requestLogger = req.log ?? logger

  requestLogger.error({ err: error }, 'request failed')

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    })
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: error.flatten(),
      },
    })
    return
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: {
        code: 'invalid_json',
        message: 'Request body contains invalid JSON',
      },
    })
    return
  }

  res.status(500).json({
    error: {
      code: 'internal_server_error',
      message: 'An unexpected error occurred',
    },
  })
}

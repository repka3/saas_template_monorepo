import type { RequestHandler } from 'express'
import { type ZodTypeAny, ZodError } from 'zod'

import { HttpError } from '../lib/http-error.js'

type ValidationSchema = {
  body?: ZodTypeAny
  params?: ZodTypeAny
  query?: ZodTypeAny
}

const replaceRequestValue = <T extends 'body' | 'params' | 'query'>(
  req: Parameters<RequestHandler>[0],
  key: T,
  value: unknown,
) => {
  Object.defineProperty(req, key, {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  })
}

export const validate = (schema: ValidationSchema): RequestHandler => {
  return (req, _res, next) => {
    try {
      if (schema.params) {
        replaceRequestValue(req, 'params', schema.params.parse(req.params))
      }

      if (schema.query) {
        replaceRequestValue(req, 'query', schema.query.parse(req.query))
      }

      if (schema.body) {
        replaceRequestValue(req, 'body', schema.body.parse(req.body))
      }

      next()
    } catch (error) {
      if (error instanceof ZodError) {
        next(new HttpError(400, 'validation_error', 'Request validation failed', error.flatten() as Record<string, unknown>))
        return
      }
      next(error)
    }
  }
}

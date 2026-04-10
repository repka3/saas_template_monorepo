import type { RequestHandler } from 'express'
import type { ZodTypeAny } from 'zod'

import { HttpError } from '../lib/http-error.js'

type ValidationSchema = {
  body?: ZodTypeAny
  params?: ZodTypeAny
  query?: ZodTypeAny
}

export const validate = (schema: ValidationSchema): RequestHandler => {
  return (req, _res, next) => {
    try {
      if (schema.params) {
        req.params = schema.params.parse(req.params) as typeof req.params
      }

      if (schema.query) {
        req.query = schema.query.parse(req.query) as typeof req.query
      }

      if (schema.body) {
        req.body = schema.body.parse(req.body)
      }

      next()
    } catch (error) {
      next(new HttpError(400, 'validation_error', 'Request validation failed', error))
    }
  }
}

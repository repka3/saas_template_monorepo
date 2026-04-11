import { randomUUID } from 'node:crypto'

import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { toNodeHandler } from 'better-auth/node'

import { auth } from './lib/auth.js'
import { ERROR_CODES } from '@repo/contracts'

import { buildApiErrorResponse } from './lib/api-error-response.js'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { dummyPrivateRouter } from './routes/dummyPrivateRoutes.js'
import { publicHealthRouter } from './routes/publicHealthRoutes.js'

const JSON_BODY_LIMIT = '100kb'
const URLENCODED_BODY_LIMIT = '50kb'

export const app = express()

app.disable('x-powered-by')
app.set('trust proxy', env.TRUST_PROXY)

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => {
      const headerRequestId = req.headers['x-request-id']

      return typeof headerRequestId === 'string' && headerRequestId.length > 0 ? headerRequestId : randomUUID()
    },
    quietReqLogger: true,
    quietResLogger: true,
    customSuccessMessage: () => 'request completed',
    customErrorMessage: () => 'request failed',
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  }),
)

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

app.use(helmet())

// Better Auth must be mounted before express.json() on Express.
app.all('/api/auth/*splat', toNodeHandler(auth))

app.use(express.json({ limit: JSON_BODY_LIMIT }))
app.use(express.urlencoded({ extended: false, limit: URLENCODED_BODY_LIMIT, parameterLimit: 100 }))

app.use('/api', publicHealthRouter)
app.use('/api', dummyPrivateRouter)

app.use((req, res) => {
  res.status(404).json(buildApiErrorResponse(req, ERROR_CODES.NOT_FOUND, 'Route not found'))
})

app.use(errorHandler)

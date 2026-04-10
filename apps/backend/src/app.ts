import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { toNodeHandler } from 'better-auth/node'

import { auth } from './lib/auth.js'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { healthRouter } from './routes/health.js'

export const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(
  pinoHttp({
    logger,
    customSuccessMessage: () => 'request completed',
    customErrorMessage: () => 'request failed',
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

app.use(express.json())

app.use(healthRouter)

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: 'Route not found',
    },
  })
})

app.use(errorHandler)

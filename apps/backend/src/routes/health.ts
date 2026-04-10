import { Router } from 'express'

import { HttpError } from '../lib/http-error.js'
import { prisma } from '../lib/prisma.js'

export const healthRouter = Router()

healthRouter.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

healthRouter.get('/readyz', async (_req, res, next) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    res.status(200).json({ status: 'ok' })
  } catch (error) {
    next(
      new HttpError(503, 'database_unavailable', 'Database is not ready', {
        cause: error instanceof Error ? error.message : 'Unknown error',
      }),
    )
  }
})

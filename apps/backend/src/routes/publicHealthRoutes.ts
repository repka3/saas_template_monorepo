import { Router } from 'express'

import { getPublicAuthConfig, ping } from '../controllers/publicHealthControllers.js'
import { publicRouteRateLimit } from '../middleware/rate-limit.js'

export const publicHealthRouter = Router()

publicHealthRouter.get('/ping', publicRouteRateLimit, ping)
publicHealthRouter.get('/auth-config', publicRouteRateLimit, getPublicAuthConfig)

import { Router } from 'express'

import { getPublicAuthConfig, health, ping } from '../controllers/publicHealthControllers.js'
import { publicRouteRateLimit } from '../middleware/rate-limit.js'

export const publicHealthRouter = Router()

publicHealthRouter.get('/ping', publicRouteRateLimit, ping)
publicHealthRouter.get('/health', publicRouteRateLimit, health)
publicHealthRouter.get('/auth-config', publicRouteRateLimit, getPublicAuthConfig)

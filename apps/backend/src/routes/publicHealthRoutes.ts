import { Router } from 'express'

import { getPublicAuthConfig, health, ping, testErrorController } from '../controllers/publicHealthControllers.js'

export const publicHealthRouter = Router()

publicHealthRouter.get('/ping', ping)
publicHealthRouter.get('/health', health)
publicHealthRouter.get('/auth-config', getPublicAuthConfig)

publicHealthRouter.get('/test_error_500', testErrorController)

import { Router } from 'express'

import { health, ping } from '../controllers/publicHealthControllers.js'

export const publicHealthRouter = Router()

publicHealthRouter.get('/ping', ping)
publicHealthRouter.get('/health', health)

import { Router } from 'express'

import { getDummyPrivate, getDummySuperadmin } from '../controllers/dummyPrivateController.js'
import { requireAuthenticatedUser, requirePasswordChangeNotRequired, requireRole } from '../middleware/auth-guards.js'

export const dummyPrivateRouter = Router()

const commonMiddleware = [requireAuthenticatedUser, requirePasswordChangeNotRequired] as const

dummyPrivateRouter.get('/dummy-private', ...commonMiddleware, getDummyPrivate)

dummyPrivateRouter.get('/dummy-superadmin', ...commonMiddleware, requireRole('superadmin'), getDummySuperadmin)

import { Router } from 'express'

import { getDummyPrivate, getDummySuperadmin } from '../controllers/dummyPrivateController.js'
import { requireAuthenticatedUser, requirePasswordChangeNotRequired, requireSystemRole } from '../middleware/auth-guards.js'

export const dummyPrivateRouter = Router()

const commonMiddleware = [requireAuthenticatedUser, requirePasswordChangeNotRequired] as const

dummyPrivateRouter.get('/dummy-private', ...commonMiddleware, getDummyPrivate)

dummyPrivateRouter.get('/dummy-superadmin', ...commonMiddleware, requireSystemRole('SUPERADMIN'), getDummySuperadmin)

import { Router } from 'express'

import { getDummyPrivate, getDummySuperadmin } from '../controllers/dummyPrivateController.js'
import { requireAuthenticatedUser, requireSystemRole } from '../middleware/auth-guards.js'

export const dummyPrivateRouter = Router()

dummyPrivateRouter.get('/dummy-private', requireAuthenticatedUser, getDummyPrivate)

dummyPrivateRouter.get('/dummy-superadmin', requireAuthenticatedUser, requireSystemRole('SUPERADMIN'), getDummySuperadmin)


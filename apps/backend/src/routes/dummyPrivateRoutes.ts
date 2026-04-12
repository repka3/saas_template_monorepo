import { Router } from 'express'

import { getDummyPrivate, getDummySuperadmin } from '../controllers/dummyPrivateController.js'
import { requireAuthenticatedUser, requirePasswordChangeNotRequired, requireSystemRole } from '../middleware/auth-guards.js'

export const dummyPrivateRouter = Router()

dummyPrivateRouter.get('/dummy-private', requireAuthenticatedUser, requirePasswordChangeNotRequired, getDummyPrivate)

dummyPrivateRouter.get('/dummy-superadmin', requireAuthenticatedUser, requirePasswordChangeNotRequired, requireSystemRole('SUPERADMIN'), getDummySuperadmin)

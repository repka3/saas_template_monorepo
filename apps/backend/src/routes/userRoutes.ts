import { Router } from 'express'

import {
  createUserController,
  getSuperadminUserByIdController,
  getUserByIdController,
  listUsersController,
  patchMyProfileController,
  updateUserController,
  updateUserRoleController,
} from '../controllers/userControllers.js'
import { requireAuthenticatedUser, requirePasswordChangeNotRequired, requireRole } from '../middleware/auth-guards.js'
import { authenticatedRouteRateLimit } from '../middleware/rate-limit.js'
import { uploadAvatar } from '../middleware/upload-avatar.js'
import { validate } from '../middleware/validate.js'
import { validateProfileUpdate } from '../middleware/validate-profile.js'
import { createUserSchema, listUsersQuerySchema, updateUserParamsSchema, updateUserRoleSchema, updateUserSchema } from '../validation/superadmin-users.js'

export const userRouter = Router()

const commonMiddleware = [requireAuthenticatedUser, authenticatedRouteRateLimit, requirePasswordChangeNotRequired] as const

userRouter.get('/users/:id', ...commonMiddleware, getUserByIdController)
userRouter.get('/superadmin/users', ...commonMiddleware, requireRole('superadmin'), validate({ query: listUsersQuerySchema }), listUsersController)
userRouter.post('/superadmin/users', ...commonMiddleware, requireRole('superadmin'), validate({ body: createUserSchema }), createUserController)
userRouter.get(
  '/superadmin/users/:id',
  ...commonMiddleware,
  requireRole('superadmin'),
  validate({ params: updateUserParamsSchema }),
  getSuperadminUserByIdController,
)
userRouter.patch(
  '/superadmin/users/:id',
  ...commonMiddleware,
  requireRole('superadmin'),
  validate({ params: updateUserParamsSchema, body: updateUserSchema }),
  updateUserController,
)
userRouter.patch(
  '/superadmin/users/:id/role',
  ...commonMiddleware,
  requireRole('superadmin'),
  validate({ params: updateUserParamsSchema, body: updateUserRoleSchema }),
  updateUserRoleController,
)
userRouter.patch('/users/me/profile', ...commonMiddleware, uploadAvatar, validateProfileUpdate, patchMyProfileController)

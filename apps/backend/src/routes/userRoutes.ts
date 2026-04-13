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
import { authenticatedReadRateLimit, profileMutationRateLimit, superadminMutationRateLimit, superadminReadRateLimit } from '../middleware/rate-limit.js'
import { uploadAvatar } from '../middleware/upload-avatar.js'
import { validate } from '../middleware/validate.js'
import { validateProfileUpdate } from '../middleware/validate-profile.js'
import { createUserSchema, listUsersQuerySchema, updateUserParamsSchema, updateUserRoleSchema, updateUserSchema } from '../validation/superadmin-users.js'

export const userRouter = Router()

const commonMiddleware = [requireAuthenticatedUser, requirePasswordChangeNotRequired] as const

userRouter.get('/users/:id', ...commonMiddleware, authenticatedReadRateLimit, getUserByIdController)
userRouter.get(
  '/superadmin/users',
  ...commonMiddleware,
  requireRole('superadmin'),
  superadminReadRateLimit,
  validate({ query: listUsersQuerySchema }),
  listUsersController,
)
userRouter.post(
  '/superadmin/users',
  ...commonMiddleware,
  requireRole('superadmin'),
  superadminMutationRateLimit,
  validate({ body: createUserSchema }),
  createUserController,
)
userRouter.get(
  '/superadmin/users/:id',
  ...commonMiddleware,
  requireRole('superadmin'),
  superadminReadRateLimit,
  validate({ params: updateUserParamsSchema }),
  getSuperadminUserByIdController,
)
userRouter.patch(
  '/superadmin/users/:id',
  ...commonMiddleware,
  requireRole('superadmin'),
  superadminMutationRateLimit,
  validate({ params: updateUserParamsSchema, body: updateUserSchema }),
  updateUserController,
)
userRouter.patch(
  '/superadmin/users/:id/role',
  ...commonMiddleware,
  requireRole('superadmin'),
  superadminMutationRateLimit,
  validate({ params: updateUserParamsSchema, body: updateUserRoleSchema }),
  updateUserRoleController,
)
userRouter.patch('/users/me/profile', ...commonMiddleware, profileMutationRateLimit, uploadAvatar, validateProfileUpdate, patchMyProfileController)

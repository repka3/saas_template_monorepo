import { Router } from 'express'

import {
  createUserController,
  getSuperadminUserByIdController,
  getUserByIdController,
  listUsersController,
  patchMyProfileController,
  updateUserController,
} from '../controllers/userControllers.js'
import { requireAuthenticatedUser, requirePasswordChangeNotRequired, requireSystemRole } from '../middleware/auth-guards.js'
import { uploadAvatar } from '../middleware/upload-avatar.js'
import { validate } from '../middleware/validate.js'
import { validateProfileUpdate } from '../middleware/validate-profile.js'
import { createUserSchema, listUsersQuerySchema, updateUserParamsSchema, updateUserSchema } from '../validation/superadmin-users.js'

export const userRouter = Router()

const commonMiddleware = [requireAuthenticatedUser, requirePasswordChangeNotRequired] as const

userRouter.get('/users/:id', ...commonMiddleware, getUserByIdController)
userRouter.get('/superadmin/users', ...commonMiddleware, requireSystemRole('SUPERADMIN'), validate({ query: listUsersQuerySchema }), listUsersController)
userRouter.post('/superadmin/users', ...commonMiddleware, requireSystemRole('SUPERADMIN'), validate({ body: createUserSchema }), createUserController)
userRouter.get('/superadmin/users/:id', ...commonMiddleware, requireSystemRole('SUPERADMIN'), validate({ params: updateUserParamsSchema }), getSuperadminUserByIdController)
userRouter.patch(
  '/superadmin/users/:id',
  ...commonMiddleware,
  requireSystemRole('SUPERADMIN'),
  validate({ params: updateUserParamsSchema, body: updateUserSchema }),
  updateUserController,
)
userRouter.patch('/users/me/profile', ...commonMiddleware, uploadAvatar, validateProfileUpdate, patchMyProfileController)

import { Router } from 'express'

import {
  createUserController,
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

userRouter.get('/users', requireAuthenticatedUser, requirePasswordChangeNotRequired, requireSystemRole('SUPERADMIN'), validate({ query: listUsersQuerySchema }), listUsersController)
userRouter.post('/users', requireAuthenticatedUser, requirePasswordChangeNotRequired, requireSystemRole('SUPERADMIN'), validate({ body: createUserSchema }), createUserController)
userRouter.get('/users/:id', requireAuthenticatedUser, requirePasswordChangeNotRequired, getUserByIdController)
userRouter.patch(
  '/users/:id',
  requireAuthenticatedUser,
  requirePasswordChangeNotRequired,
  requireSystemRole('SUPERADMIN'),
  validate({ params: updateUserParamsSchema, body: updateUserSchema }),
  updateUserController,
)
userRouter.patch('/users/me/profile', requireAuthenticatedUser, requirePasswordChangeNotRequired, uploadAvatar, validateProfileUpdate, patchMyProfileController)

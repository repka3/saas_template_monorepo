import { Router } from 'express'

import { getUserByIdController, patchMyProfileController } from '../controllers/userControllers.js'
import { requireAuthenticatedUser } from '../middleware/auth-guards.js'
import { uploadAvatar } from '../middleware/upload-avatar.js'
import { validateProfileUpdate } from '../middleware/validate-profile.js'

export const userRouter = Router()

userRouter.get('/users/:id', requireAuthenticatedUser, getUserByIdController)
userRouter.patch('/users/me/profile', requireAuthenticatedUser, uploadAvatar, validateProfileUpdate, patchMyProfileController)

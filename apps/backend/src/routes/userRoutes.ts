import { Router } from 'express'

import { getUserByIdController } from '../controllers/userControllers.js'
import { requireAuthenticatedUser } from '../middleware/auth-guards.js'

export const userRouter = Router()

userRouter.get('/users/:id', requireAuthenticatedUser, getUserByIdController)

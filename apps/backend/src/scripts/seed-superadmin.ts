import { deriveDefaultNameFromEmail } from '@repo/contracts'
import { APIError } from 'better-auth'

import { INTERNAL_BOOTSTRAP_SIGN_UP_HEADER, auth } from '../lib/auth.js'
import { env } from '../lib/env.js'
import { prisma } from '../lib/prisma.js'

const getRequiredEnv = (value: string | undefined, name: string) => {
  const trimmed = value?.trim()

  if (!trimmed) {
    throw new Error(`${name} is required to seed the bootstrap superadmin`)
  }

  return trimmed
}

const seedSuperadmin = async () => {
  const email = getRequiredEnv(env.SUPERADMIN_EMAIL, 'SUPERADMIN_EMAIL').toLowerCase()
  const password = getRequiredEnv(env.SUPERADMIN_PASSWORD, 'SUPERADMIN_PASSWORD')
  const name = env.SUPERADMIN_NAME?.trim() || deriveDefaultNameFromEmail(email)

  let user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
    },
  })

  let created = false

  if (!user) {
    try {
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name,
        },
        headers: new Headers({
          [INTERNAL_BOOTSTRAP_SIGN_UP_HEADER]: env.BETTER_AUTH_SECRET,
        }),
      })

      user = {
        id: signUpResult.user.id,
      }
      created = true
    } catch (error) {
      const duplicateEmail = error instanceof APIError && typeof error.body?.code === 'string' && error.body.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'

      if (!duplicateEmail) {
        throw error
      }

      user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
        },
      })
    }
  }

  if (!user) {
    throw new Error('Bootstrap superadmin could not be created or reloaded')
  }

  const seededUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      role: 'superadmin',
      emailVerified: true,
      banned: false,
      banReason: null,
      banExpires: null,
      mustChangePassword: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      banned: true,
      mustChangePassword: true,
    },
  })

  console.log(
    JSON.stringify(
      {
        created,
        user: seededUser,
      },
      null,
      2,
    ),
  )
}

try {
  await seedSuperadmin()
} finally {
  await prisma.$disconnect()
}

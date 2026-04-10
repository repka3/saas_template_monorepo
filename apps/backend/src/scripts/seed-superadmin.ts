import { randomUUID } from 'node:crypto'

import { hashPassword } from 'better-auth/crypto'

import { deriveDefaultNameFromEmail } from '../lib/auth-schema.js'
import { env } from '../lib/env.js'
import { prisma } from '../lib/prisma.js'

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const getSuperadminCredentials = () => {
  if (!env.SUPERADMIN_EMAIL || !env.SUPERADMIN_PASSWORD) {
    throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set before running the seed.')
  }

  return {
    email: normalizeEmail(env.SUPERADMIN_EMAIL),
    password: env.SUPERADMIN_PASSWORD,
  }
}

const ensureSuperadmin = async () => {
  const { email, password } = getSuperadminCredentials()
  const name = deriveDefaultNameFromEmail(email)
  const passwordHash = await hashPassword(password)

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  const userId = existingUser?.id ?? randomUUID()

  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { email },
      update: {
        name,
        emailVerified: true,
        systemRole: 'SUPERADMIN',
        isActive: true,
      },
      create: {
        id: userId,
        email,
        name,
        emailVerified: true,
        systemRole: 'SUPERADMIN',
        isActive: true,
      },
    })

    await tx.user.updateMany({
      where: {
        systemRole: 'SUPERADMIN',
        NOT: {
          id: userId,
        },
      },
      data: {
        systemRole: 'USER',
      },
    })

    const credentialAccount = await tx.account.findFirst({
      where: {
        userId,
        providerId: 'credential',
      },
      select: { id: true },
    })

    if (credentialAccount) {
      await tx.account.update({
        where: { id: credentialAccount.id },
        data: {
          accountId: userId,
          password: passwordHash,
        },
      })
      return
    }

    await tx.account.create({
      data: {
        id: randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: passwordHash,
      },
    })
  })

  console.log(`Seeded superadmin: ${email}`)
}

ensureSuperadmin()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

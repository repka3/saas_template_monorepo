import { prisma } from '../lib/prisma.js'

export const getUserById = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      systemRole: true,
      isActive: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          avatarPath: true,
        },
      },
    },
  })

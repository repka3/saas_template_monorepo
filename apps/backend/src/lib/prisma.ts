import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client.js'
import { env } from './env.js'

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

export const buildPrismaPoolConfig = (connectionString: string, connectionLimit?: number) => {
  const poolConfig = { connectionString } as { connectionString: string; max?: number }

  if (connectionLimit !== undefined) {
    poolConfig.max = connectionLimit
  }

  return poolConfig
}

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg(buildPrismaPoolConfig(env.DATABASE_URL, env.PRISMA_CONNECTION_LIMIT)),
  })

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

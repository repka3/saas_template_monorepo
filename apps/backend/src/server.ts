import { app } from './app.js'
import { env } from './lib/env.js'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'

const shutdown = (server: ReturnType<typeof app.listen>, signal: string) => {
  logger.info({ signal }, 'shutting down backend')

  server.close(async (error) => {
    if (error) {
      logger.error({ err: error }, 'failed to close HTTP server')
      process.exitCode = 1
    }

    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      logger.error({ err: disconnectError }, 'failed to disconnect prisma')
      process.exitCode = 1
    } finally {
      process.exit()
    }
  })
}

const startServer = async () => {
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'backend listening')
  })

  process.on('SIGINT', () => shutdown(server, 'SIGINT'))
  process.on('SIGTERM', () => shutdown(server, 'SIGTERM'))
}

void startServer().catch(async (error) => {
  logger.fatal({ err: error }, 'backend failed to start')

  try {
    await prisma.$disconnect()
  } catch (disconnectError) {
    logger.error({ err: disconnectError }, 'failed to disconnect prisma after startup failure')
  } finally {
    process.exit(1)
  }
})

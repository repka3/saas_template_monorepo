import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const defaultDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/saas_template'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  },
})

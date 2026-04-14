import 'dotenv/config'
import { z } from 'zod'

const AUTH_SIGNUP_MODE_VALUES = ['public', 'admin_only'] as const

const trustProxySchema = z.string().transform((value, context) => {
  const normalizedValue = value.trim().toLowerCase()

  if (normalizedValue === 'false') {
    return false
  }

  const parsedHopCount = Number.parseInt(value, 10)

  if (Number.isInteger(parsedHopCount) && parsedHopCount > 0) {
    return parsedHopCount
  }

  context.addIssue({
    code: 'custom',
    message: 'TRUST_PROXY must be "false" or a positive integer hop count.',
  })

  return z.NEVER
})

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().min(1),
  PRISMA_CONNECTION_LIMIT: z.coerce.number().int().positive().optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  CORS_ORIGIN: z.string().url(),
  TRUST_PROXY: trustProxySchema,
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string().min(1),
  SUPERADMIN_EMAIL: z.string().email().optional(),
  SUPERADMIN_PASSWORD: z.string().min(12).optional(),
  SUPERADMIN_NAME: z.string().trim().min(1).optional(),
  AUTH_SIGNUP_MODE: z.enum(AUTH_SIGNUP_MODE_VALUES).default('public'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  UPLOADS_DIR: z.string().default('.tmp/uploads'),
  MAX_AVATAR_UPLOAD_BYTES: z.coerce.number().int().positive().default(2_097_152),
})

export const parseEnv = (input: NodeJS.ProcessEnv) => {
  const parsedEnv = envSchema.safeParse(input)

  if (!parsedEnv.success) {
    throw new Error(`Invalid environment variables: ${parsedEnv.error.message}`)
  }

  return parsedEnv.data
}

export const env = parseEnv(process.env)

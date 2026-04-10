import { APIError, betterAuth } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'
import { prismaAdapter } from 'better-auth/adapters/prisma'

import { authUserAdditionalFields } from './auth-schema.js'
import { env } from './env.js'
import { sendPasswordResetEmailMessage, sendVerificationEmailMessage } from './mailer.js'
import { prisma } from './prisma.js'

export const auth = betterAuth({
  appName: 'Auth Baseline',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CORS_ORIGIN],
  user: {
    additionalFields: authUserAdditionalFields,
  },
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmailMessage({
        to: user.email,
        resetUrl: url,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ token, user }) => {
      const verificationUrl = new URL('/verify-email', env.CORS_ORIGIN)
      verificationUrl.searchParams.set('token', token)

      await sendVerificationEmailMessage({
        to: user.email,
        verificationUrl: verificationUrl.toString(),
      })
    },
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== '/sign-in/email') {
        return
      }

      const email = typeof context.body.email === 'string' ? context.body.email.trim().toLowerCase() : ''

      if (!email) {
        return
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { isActive: true },
      })

      if (!user?.isActive) {
        throw APIError.from('FORBIDDEN', {
          code: 'ACCOUNT_INACTIVE',
          message: 'Your account is inactive.',
        })
      }
    }),
  },
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
})

export type AuthSession = typeof auth.$Infer.Session
export type AuthSessionUser = AuthSession['user']

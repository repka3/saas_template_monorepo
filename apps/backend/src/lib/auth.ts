import { APIError, betterAuth } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin as adminPlugin } from 'better-auth/plugins/admin'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'

import { authUserAdditionalFields } from './auth-schema.js'
import { env } from './env.js'
import { sendPasswordResetEmailMessage, sendVerificationEmailMessage } from './mailer.js'
import { prisma } from './prisma.js'

type AuthHookContext = {
  path: string
  body?: {
    email?: unknown
  }
  context: {
    returned?: unknown
    session?: {
      user?: {
        id?: string
      }
    } | null
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

export const blockBannedUserBeforeSignIn = async (context: AuthHookContext) => {
  if (context.path !== '/sign-in/email') {
    return
  }

  const email = typeof context.body?.email === 'string' ? context.body.email.trim().toLowerCase() : ''

  if (!email) {
    return
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { banned: true },
  })

  if (user?.banned) {
    throw APIError.from('FORBIDDEN', {
      code: 'BANNED_USER',
      message: 'Your account is disabled.',
    })
  }
}

export const clearMustChangePasswordAfterPasswordChange = async (context: AuthHookContext) => {
  if (context.path !== '/change-password') {
    return
  }

  if (context.context.returned instanceof APIError) {
    return
  }

  const userId = context.context.session?.user?.id

  if (!userId) {
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      mustChangePassword: false,
    },
  })

  const returned = context.context.returned

  if (!isObject(returned) || !('user' in returned) || !isObject(returned.user)) {
    return
  }

  returned.user.mustChangePassword = false
}

export const auth = betterAuth({
  appName: 'Auth Baseline',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CORS_ORIGIN],
  user: {
    additionalFields: authUserAdditionalFields,
  },
  plugins: [
    adminPlugin({
      defaultRole: 'user',
      adminRoles: ['superadmin'],
      roles: {
        user: userAc,
        superadmin: adminAc,
      },
    }),
  ],
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
  session: {
    cookieCache: {
      enabled: false,
    },
  },
  hooks: {
    before: createAuthMiddleware(blockBannedUserBeforeSignIn),
    after: createAuthMiddleware(clearMustChangePasswordAfterPasswordChange),
  },
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
})

export type AuthSession = typeof auth.$Infer.Session
export type AuthSessionUser = AuthSession['user']

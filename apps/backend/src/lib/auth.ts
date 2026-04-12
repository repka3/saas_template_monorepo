import { APIError, betterAuth } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin as adminPlugin } from 'better-auth/plugins/admin'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'

import { authUserAdditionalFields } from './auth-schema.js'
import { env } from './env.js'
import { dispatchAuthEmail, sendPasswordResetEmailMessage, sendVerificationEmailMessage } from './mailer.js'
import { prisma } from './prisma.js'

type AuthHookContext = {
  headers?: Headers
  path: string
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

export const INTERNAL_BOOTSTRAP_SIGN_UP_HEADER = 'x-bootstrap-superadmin-secret'

export const blockPublicSignUp = async (context: AuthHookContext) => {
  if (context.path !== '/sign-up/email') {
    return
  }

  if (context.headers?.get(INTERNAL_BOOTSTRAP_SIGN_UP_HEADER) === env.BETTER_AUTH_SECRET) {
    return
  }

  throw APIError.from('FORBIDDEN', {
    code: 'SIGN_UP_DISABLED',
    message: 'Public sign-up is disabled.',
  })
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
      bannedUserMessage: 'Your account is disabled.',
      roles: {
        user: userAc,
        superadmin: adminAc,
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      dispatchAuthEmail(
        sendPasswordResetEmailMessage({
          to: user.email,
          resetUrl: url,
        }),
        {
          flow: 'password-reset',
          to: user.email,
        },
      )
    },
  },
  emailVerification: {
    sendOnSignIn: true,
    sendVerificationEmail: async ({ user, url }) => {
      dispatchAuthEmail(
        sendVerificationEmailMessage({
          to: user.email,
          verificationUrl: url,
        }),
        {
          flow: 'verification',
          to: user.email,
        },
      )
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
    before: createAuthMiddleware(blockPublicSignUp),
    after: createAuthMiddleware(clearMustChangePasswordAfterPasswordChange),
  },
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
})

export type AuthSession = typeof auth.$Infer.Session
export type AuthSessionUser = AuthSession['user']

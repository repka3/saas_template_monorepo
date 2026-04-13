import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePublicAuthConfigQuery } from '@/features/auth/public-auth-config-hooks'
import { useAuth } from '@/hooks/use-auth'
import { authClient, deriveDefaultNameFromEmail, getEntryPathForUser, toAbsoluteAppUrl } from '@/lib/auth-client'
import { AuthFeedback, AuthRouteLayout, FullScreenInline, FullScreenState, RouteLinkButton } from '@/routes/route-shell'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isEmailVerificationError = (error: { message?: string; status?: number } | null | undefined) => {
  if (!error) {
    return false
  }

  return error.status === 403 && /verif/i.test(error.message ?? '')
}

export function LoginPage() {
  const navigate = useNavigate()
  const publicAuthConfigQuery = usePublicAuthConfigQuery()
  const canSelfRegister = publicAuthConfigQuery.data?.auth.canSelfRegister === true
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setVerificationEmail(null)
    setVerificationNotice(null)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '')
      .trim()
      .toLowerCase()
    const password = String(formData.get('password') || '')

    if (!EMAIL_PATTERN.test(email)) {
      setError('Enter a valid email address.')
      return
    }

    if (!password) {
      setError('Enter your password.')
      return
    }

    setIsSubmitting(true)

    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: toAbsoluteAppUrl('/'),
    })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error.message || 'Unable to sign in.')

      if (isEmailVerificationError(result.error)) {
        setVerificationEmail(email)
        setVerificationNotice('Email verification is required before sign-in. A new verification email is sent automatically on each login attempt.')
      }

      return
    }

    navigate(getEntryPathForUser(result.data.user), { replace: true })
  }

  const handleResendVerification = async () => {
    if (!verificationEmail) {
      return
    }

    setIsResendingVerification(true)

    const result = await authClient.sendVerificationEmail({
      email: verificationEmail,
      callbackURL: toAbsoluteAppUrl('/'),
    })

    setIsResendingVerification(false)

    if (result.error) {
      setError(result.error.message || 'Unable to resend the verification email.')
      return
    }

    setVerificationNotice(`Verification email sent to ${verificationEmail}.`)
  }

  return (
    <AuthRouteLayout
      eyebrow="Welcome Back"
      title="Log in"
      description="Use your email and password to continue into the reusable auth shell."
      alternateAction={canSelfRegister ? { href: '/register', label: 'Create an account' } : undefined}
    >
      <AuthFeedback error={error} />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input autoComplete="email" name="email" placeholder="Email address" type="email" />
        <Input autoComplete="current-password" name="password" placeholder="Password" type="password" />
        <Button className="w-full justify-between" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Signing in' : 'Log in'}
          {isSubmitting ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
        </Button>
      </form>
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>Need a reset?</span>
        <RouteLinkButton size="sm" to="/forgot-password" variant="link">
          Forgot password
        </RouteLinkButton>
      </div>
      {verificationEmail ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Verification required</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{verificationNotice}</p>
            <Button className="w-full justify-between sm:w-auto" disabled={isResendingVerification} onClick={handleResendVerification} variant="outline">
              {isResendingVerification ? 'Sending verification email' : 'Resend verification email'}
              {isResendingVerification ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </AuthRouteLayout>
  )
}

export function RegisterRoute() {
  const publicAuthConfigQuery = usePublicAuthConfigQuery()

  if (publicAuthConfigQuery.isPending) {
    return <FullScreenState label="Loading registration policy" />
  }

  return publicAuthConfigQuery.data?.auth.canSelfRegister ? <RegisterPage /> : <RegistrationDisabledPage />
}

function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '')
      .trim()
      .toLowerCase()
    const password = String(formData.get('password') || '')
    const confirmPassword = String(formData.get('confirmPassword') || '')

    if (!EMAIL_PATTERN.test(email)) {
      setError('Enter a valid email address.')
      return
    }

    if (password.length < 8) {
      setError('Use at least 8 characters for the password.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    const result = await authClient.signUp.email({
      email,
      password,
      name: deriveDefaultNameFromEmail(email),
      callbackURL: toAbsoluteAppUrl('/'),
    })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error.message || 'Unable to create the account.')
      return
    }

    setSuccess('Account created. Check your email for the verification link before logging in.')
    event.currentTarget.reset()
  }

  return (
    <AuthRouteLayout
      eyebrow="Public Signup"
      title="Create account"
      description="Registration is email-and-password only. New accounts always start as standard users."
      alternateAction={{
        href: '/login',
        label: 'Already have an account?',
      }}
    >
      <AuthFeedback error={error} success={success} />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input autoComplete="email" name="email" placeholder="Email address" type="email" />
        <Input autoComplete="new-password" name="password" placeholder="Password" type="password" />
        <Input autoComplete="new-password" name="confirmPassword" placeholder="Confirm password" type="password" />
        <Button className="w-full justify-between" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Creating account' : 'Create account'}
          {isSubmitting ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
        </Button>
      </form>
    </AuthRouteLayout>
  )
}

function RegistrationDisabledPage() {
  return (
    <AuthRouteLayout
      eyebrow="Admin Provisioning"
      title="Registration disabled"
      description="Accounts are created by a superadmin in this phase. Use the bootstrap flow for the first superadmin, then let admins provision everyone else."
      alternateAction={{
        href: '/login',
        label: 'Back to login',
      }}
    >
      <Alert>
        <TriangleAlert />
        <AlertTitle>Public sign-up is off</AlertTitle>
        <AlertDescription>Ask an administrator to create your account, or follow the backend bootstrap steps if this is a fresh environment.</AlertDescription>
      </Alert>
    </AuthRouteLayout>
  )
}

export function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '')
      .trim()
      .toLowerCase()

    if (!EMAIL_PATTERN.test(email)) {
      setError('Enter a valid email address.')
      return
    }

    setIsSubmitting(true)

    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: toAbsoluteAppUrl('/reset-password'),
    })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error.message || 'Unable to send the reset email.')
      return
    }

    setSuccess('If that address exists, a reset email is on its way.')
  }

  return (
    <AuthRouteLayout
      eyebrow="Password Reset"
      title="Forgot password"
      description="Request a reset link that brings you back to this dashboard baseline."
      alternateAction={{
        href: '/login',
        label: 'Back to login',
      }}
    >
      <AuthFeedback error={error} success={success} />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input autoComplete="email" name="email" placeholder="Email address" type="email" />
        <Button className="w-full justify-between" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Sending reset link' : 'Send reset link'}
          {isSubmitting ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
        </Button>
      </form>
    </AuthRouteLayout>
  )
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!token) {
      setError('This reset link is missing a token.')
      return
    }

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password') || '')
    const confirmPassword = String(formData.get('confirmPassword') || '')

    if (password.length < 8) {
      setError('Use at least 8 characters for the new password.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error.message || 'Unable to reset the password.')
      return
    }

    setSuccess('Password updated. You can log in with the new password now.')

    window.setTimeout(() => {
      navigate('/login', { replace: true })
    }, 1200)
  }

  return (
    <AuthRouteLayout
      eyebrow="Password Reset"
      title="Choose a new password"
      description="This route expects the reset token from the email link."
      alternateAction={{
        href: '/login',
        label: 'Back to login',
      }}
    >
      <AuthFeedback error={error} success={success} />
      {!token ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Missing token</AlertTitle>
          <AlertDescription>Open the reset link from the email, or request a fresh one.</AlertDescription>
        </Alert>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input autoComplete="new-password" name="password" placeholder="New password" type="password" />
          <Input autoComplete="new-password" name="confirmPassword" placeholder="Confirm new password" type="password" />
          <Button className="w-full justify-between" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Saving password' : 'Reset password'}
            {isSubmitting ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
          </Button>
        </form>
      )}
    </AuthRouteLayout>
  )
}

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const { entryPath, refetch, user } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const hasTriggered = useRef(false)
  const [state, setState] = useState<{
    error: string | null
    pending: boolean
    success: string | null
  }>(() =>
    token
      ? {
          pending: true,
          error: null,
          success: null,
        }
      : {
          pending: false,
          error: 'This verification link is missing a token.',
          success: null,
        },
  )

  useEffect(() => {
    if (hasTriggered.current) {
      return
    }

    hasTriggered.current = true

    if (!token) {
      return
    }

    void (async () => {
      try {
        const result = await authClient.verifyEmail({
          query: {
            token,
          },
        })

        if (result.error) {
          setState({
            pending: false,
            error: result.error.message || 'Unable to verify this email.',
            success: null,
          })
          return
        }

        await refetch()

        setState({
          pending: false,
          error: null,
          success: 'Email verified. You can continue with the authenticated flow.',
        })
      } catch (error) {
        setState({
          pending: false,
          error: error instanceof Error ? error.message : 'Unable to verify this email.',
          success: null,
        })
      }
    })()
  }, [refetch, token])

  const destination = user ? entryPath : '/login'

  return (
    <AuthRouteLayout
      eyebrow="Email Verification"
      title="Verify email"
      description="The verification route exchanges the token with Better Auth and then sends you back into the flow."
      alternateAction={{
        href: destination,
        label: user ? 'Return to workspace' : 'Go to login',
      }}
    >
      {state.pending ? (
        <FullScreenInline label="Verifying email" />
      ) : (
        <>
          <AuthFeedback error={state.error} success={state.success} />
          <Button className="w-full justify-between" onClick={() => navigate(destination)}>
            {user ? 'Open workspace' : 'Go to login'}
            <ArrowRight />
          </Button>
        </>
      )}
    </AuthRouteLayout>
  )
}

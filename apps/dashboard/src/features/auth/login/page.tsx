import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePublicAuthConfigQuery } from '@/features/auth/public-auth-config-hooks'
import { authClient, getEntryPathForUser, toAbsoluteAppUrl } from '@/lib/auth-client'
import { AuthFeedback, AuthRouteLayout, RouteLinkButton } from '@/routes/route-shell'

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

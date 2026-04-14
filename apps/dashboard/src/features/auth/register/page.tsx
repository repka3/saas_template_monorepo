import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LoaderCircle, TriangleAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePublicAuthConfigQuery } from '@/features/auth/public-auth-config-hooks'
import { authClient, deriveDefaultNameFromEmail, toAbsoluteAppUrl } from '@/lib/auth-client'
import { AuthFeedback, AuthRouteLayout, FullScreenState } from '@/routes/route-shell'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

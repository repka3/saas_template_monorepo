import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'
import { AuthFeedback, AuthRouteLayout } from '@/routes/route-shell'

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

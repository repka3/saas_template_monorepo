import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient, toAbsoluteAppUrl } from '@/lib/auth-client'
import { AuthFeedback, AuthRouteLayout } from '@/routes/route-shell'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

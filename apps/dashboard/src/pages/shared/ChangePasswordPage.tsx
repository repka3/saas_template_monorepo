import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LoaderCircle, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { authClient, getHomePathForRole } from '@/lib/auth-client'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { refetch, user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const mustChangePassword = user?.mustChangePassword === true

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const currentPassword = String(formData.get('currentPassword') || '')
    const newPassword = String(formData.get('newPassword') || '')
    const confirmPassword = String(formData.get('confirmPassword') || '')

    if (!currentPassword) {
      setError('Enter your current password.')
      return
    }

    if (newPassword.length < 8) {
      setError('Use at least 8 characters for the new password.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    if (currentPassword === newPassword) {
      setError('Choose a password different from the current one.')
      return
    }

    setIsSubmitting(true)

    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    })

    if (result.error) {
      setIsSubmitting(false)
      setError(result.error.message || 'Unable to change the password.')
      return
    }

    await refetch()
    const refreshed = await authClient.getSession()
    const nextUser = refreshed.data?.user

    setIsSubmitting(false)

    if (!nextUser) {
      setError('Password changed, but session refresh failed. Sign in again to continue.')
      return
    }

    if (nextUser.mustChangePassword) {
      setError('Password changed, but the account still requires a password update. Try again or contact support.')
      return
    }

    toast.success('Password updated')
    navigate(getHomePathForRole(nextUser.systemRole), { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            {mustChangePassword
              ? 'This account is blocked until you choose a new password.'
              : 'Use Better Auth’s native password change flow for your current session.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {mustChangePassword ? (
            <Alert>
              <ShieldAlert />
              <AlertTitle>Password update required</AlertTitle>
              <AlertDescription>Finish this step before returning to the workspace.</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>Unable to change password</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input autoComplete="current-password" name="currentPassword" placeholder="Current password" type="password" />
            <Input autoComplete="new-password" name="newPassword" placeholder="New password" type="password" />
            <Input autoComplete="new-password" name="confirmPassword" placeholder="Confirm new password" type="password" />
            <Button className="w-full justify-between" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Saving password' : 'Change password'}
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

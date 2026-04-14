import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { authClient } from '@/lib/auth-client'
import { AuthFeedback, AuthRouteLayout, FullScreenInline } from '@/routes/route-shell'

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

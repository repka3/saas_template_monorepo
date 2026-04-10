import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, BadgeCheck, KeyRound, LoaderCircle, MailCheck, ShieldCheck, TriangleAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import SuperAdminLayout from '@/layouts/SuperAdminLayout'
import UserLayout from '@/layouts/UserLayout'
import HomeSuperadmin from '@/pages/superadmin/HomeSuperadmin'
import HomeUser from '@/pages/user/HomeUser'
import { authClient, deriveDefaultNameFromEmail, getHomePathForRole, toAbsoluteAppUrl, type AuthSessionUser } from '@/lib/auth-client'
import { useAuth } from '@/hooks/use-auth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<GuestOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRole="USER">
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeUser />} />
      </Route>
      <Route
        path="/superadmin"
        element={
          <ProtectedRoute allowedRole="SUPERADMIN">
            <SuperAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeSuperadmin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function LandingPage() {
  const { homePath, isPending, user } = useAuth()

  if (isPending) {
    return <FullScreenState label="Loading session" />
  }

  if (user) {
    return <Navigate to={homePath} replace />
  }

  return (
    <PageFrame>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-0 bg-transparent shadow-none ring-0">
          <CardHeader className="px-0">
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-foreground/10 bg-background/70 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase backdrop-blur">
              Reusable Auth Baseline
            </div>
            <CardTitle className="max-w-2xl text-4xl leading-tight sm:text-5xl">Generic authentication, seeded role routing, and email flows.</CardTitle>
            <CardDescription className="max-w-xl text-base leading-7">
              This dashboard is now a copyable auth shell: public sign-in and sign-up flows, reset and verification routes, and separate authenticated
              destinations for users and seeded superadmins.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="grid gap-4 sm:grid-cols-3">
              <HighlightCard
                icon={<ShieldCheck className="size-5" />}
                title="Role redirects"
                description="Authenticated users land on the route that matches their system role."
              />
              <HighlightCard
                icon={<MailCheck className="size-5" />}
                title="Email workflows"
                description="Verification and password reset are wired into Better Auth and SMTP."
              />
              <HighlightCard
                icon={<KeyRound className="size-5" />}
                title="Copyable baseline"
                description="All labels, routes, and states stay generic for the next project."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-foreground/10 bg-background/88 shadow-2xl shadow-slate-950/8 backdrop-blur">
          <CardHeader>
            <CardTitle>Start from the auth flow</CardTitle>
            <CardDescription>Public routes stay lightweight. Protected routes are guarded by the Better Auth session and role checks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LinkButton className="w-full justify-between" to="/login">
              Log in
              <ArrowRight />
            </LinkButton>
            <LinkButton className="w-full justify-between" to="/register" variant="outline">
              Create account
              <ArrowRight />
            </LinkButton>
            <div className="rounded-2xl border border-dashed border-foreground/12 bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
              Public registration always creates a standard user. The superadmin route is reserved for the env-seeded bootstrap account.
            </div>
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  )
}

function GuestOnlyRoute() {
  const { homePath, isPending, user } = useAuth()

  if (isPending) {
    return <FullScreenState label="Loading session" />
  }

  if (user) {
    return <Navigate to={homePath} replace />
  }

  return <Outlet />
}

function ProtectedRoute({ allowedRole, children }: { allowedRole: AuthSessionUser['systemRole']; children: ReactNode }) {
  const { homePath, isPending, user } = useAuth()

  if (isPending) {
    return <FullScreenState label="Loading workspace" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.systemRole !== allowedRole) {
    return <Navigate to={homePath} replace />
  }

  return <>{children}</>
}

function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

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
      return
    }

    navigate(getHomePathForRole(result.data.user.systemRole), { replace: true })
  }

  return (
    <AuthRouteLayout
      eyebrow="Welcome Back"
      title="Log in"
      description="Use your email and password to continue into the reusable auth shell."
      alternateAction={{
        href: '/register',
        label: 'Create an account',
      }}
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
        <LinkButton size="sm" to="/forgot-password" variant="link">
          Forgot password
        </LinkButton>
      </div>
    </AuthRouteLayout>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

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

    navigate(getHomePathForRole(result.data.user.systemRole), { replace: true })
  }

  return (
    <AuthRouteLayout
      eyebrow="Public Signup"
      title="Create account"
      description="Registration is intentionally email-and-password only. New accounts always start as standard users."
      alternateAction={{
        href: '/login',
        label: 'Already have an account?',
      }}
    >
      <AuthFeedback error={error} />
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

function ForgotPasswordPage() {
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

function ResetPasswordPage() {
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

function VerifyEmailPage() {
  const navigate = useNavigate()
  const { homePath, refetch, user } = useAuth()
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

  const destination = user ? homePath : '/login'

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

function AuthRouteLayout({
  alternateAction,
  children,
  description,
  eyebrow,
  title,
}: {
  alternateAction: {
    href: string
    label: string
  }
  children: ReactNode
  description: string
  eyebrow: string
  title: string
}) {
  return (
    <PageFrame>
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-0 bg-transparent shadow-none ring-0">
          <CardHeader className="px-0">
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-foreground/10 bg-background/70 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase backdrop-blur">
              {eyebrow}
            </div>
            <CardTitle className="max-w-xl text-4xl leading-tight sm:text-5xl">{title}</CardTitle>
            <CardDescription className="max-w-xl text-base leading-7">{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            <div className="rounded-[1.5rem] border border-foreground/10 bg-background/70 p-5 backdrop-blur">
              <p className="text-sm leading-7 text-muted-foreground">
                Every auth action is routed through Better Auth directly. No custom session wrapper API is required for the frontend to read user state.
              </p>
            </div>
            <LinkButton size="sm" to={alternateAction.href} variant="link">
              {alternateAction.label}
            </LinkButton>
          </CardContent>
        </Card>

        <Card className="border border-foreground/10 bg-background/88 shadow-2xl shadow-slate-950/8 backdrop-blur">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">{children}</CardContent>
        </Card>
      </div>
    </PageFrame>
  )
}

function HighlightCard({ description, icon, title }: { description: string; icon: ReactNode; title: string }) {
  return (
    <div className="rounded-[1.5rem] border border-foreground/10 bg-background/70 p-4 backdrop-blur">
      <div className="mb-3 inline-flex size-10 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">{icon}</div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function AuthFeedback({ error, success }: { error?: string | null; success?: string | null }) {
  if (!error && !success) {
    return null
  }

  return (
    <Alert variant={error ? 'destructive' : 'default'}>
      {error ? <TriangleAlert /> : <BadgeCheck />}
      <AlertTitle>{error ? 'Something needs attention' : 'Success'}</AlertTitle>
      <AlertDescription>{error || success}</AlertDescription>
    </Alert>
  )
}

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute inset-x-0 top-[-10rem] -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(26,86,138,0.18),transparent_62%)]" />
      <div className="absolute inset-y-0 right-[-12rem] -z-10 w-[28rem] bg-[radial-gradient(circle,rgba(245,158,11,0.12),transparent_62%)]" />
      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-5 py-10 sm:px-8 lg:px-12">{children}</main>
    </div>
  )
}

function FullScreenState({ label }: { label: string }) {
  return (
    <PageFrame>
      <div className="flex w-full items-center justify-center">
        <FullScreenInline label={label} />
      </div>
    </PageFrame>
  )
}

function FullScreenInline({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-foreground/10 bg-background/85 px-4 py-3 text-sm text-muted-foreground shadow-lg backdrop-blur">
      <LoaderCircle className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  )
}

function LinkButton({
  children,
  className,
  size = 'default',
  to,
  variant = 'default',
}: {
  children: ReactNode
  className?: string
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
  to: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
}) {
  return (
    <Link className={buttonVariants({ variant, size, className })} to={to}>
      {children}
    </Link>
  )
}

export default App

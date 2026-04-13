import type { ReactNode } from 'react'
import { ArrowRight, BadgeCheck, LoaderCircle, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function AuthRouteLayout({
  alternateAction,
  children,
  description,
  eyebrow,
  title,
}: {
  alternateAction?: {
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
            {alternateAction ? (
              <RouteLinkButton size="sm" to={alternateAction.href} variant="link">
                {alternateAction.label}
              </RouteLinkButton>
            ) : null}
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

export function AuthFeedback({ error, success }: { error?: string | null; success?: string | null }) {
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

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute inset-x-0 top-[-10rem] -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(26,86,138,0.18),transparent_62%)]" />
      <div className="absolute inset-y-0 right-[-12rem] -z-10 w-[28rem] bg-[radial-gradient(circle,rgba(245,158,11,0.12),transparent_62%)]" />
      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-5 py-10 sm:px-8 lg:px-12">{children}</main>
    </div>
  )
}

export function FullScreenState({ label }: { label: string }) {
  return (
    <PageFrame>
      <div className="flex w-full items-center justify-center">
        <FullScreenInline label={label} />
      </div>
    </PageFrame>
  )
}

export function FullScreenInline({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-foreground/10 bg-background/85 px-4 py-3 text-sm text-muted-foreground shadow-lg backdrop-blur">
      <LoaderCircle className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  )
}

export function RouteLinkButton({
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

export function RouteLoadingState({ label = 'Loading route' }: { label?: string }) {
  return <FullScreenState label={label} />
}

export function RouteActionLabel({ busy, idle }: { busy: string; idle: string }) {
  return (
    <>
      <span>{busy || idle}</span>
      {busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
    </>
  )
}

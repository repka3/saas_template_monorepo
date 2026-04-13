import { Component, type ReactNode } from 'react'
import { AlertTriangle, ArrowRight } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PageFrame, RouteLinkButton } from '@/routes/route-shell'

type RouteErrorBoundaryProps = {
  children: ReactNode
  homePath?: string
  preserveShell?: boolean
  scopeLabel: string
}

type RouteErrorBoundaryState = {
  hasError: boolean
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return {
      hasError: true,
    }
  }

  override componentDidCatch() {}

  private handleRetry = () => {
    this.setState({
      hasError: false,
    })
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const fallback = (
      <Alert className="max-w-xl border-destructive/40 bg-background/90">
        <AlertTriangle />
        <AlertTitle>{this.props.scopeLabel} failed to render</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>The navigation is still available. Retry the section or go back to a stable route.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={this.handleRetry} type="button" variant="outline">
              Retry section
            </Button>
            {this.props.homePath ? (
              <RouteLinkButton size="sm" to={this.props.homePath}>
                Return home
                <ArrowRight />
              </RouteLinkButton>
            ) : null}
          </div>
        </AlertDescription>
      </Alert>
    )

    if (this.props.preserveShell) {
      return <div className="flex w-full flex-1 items-start justify-center">{fallback}</div>
    }

    return (
      <PageFrame>
        <div className="flex w-full items-center justify-center">{fallback}</div>
      </PageFrame>
    )
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <RouteErrorBoundary scopeLabel="App">{children}</RouteErrorBoundary>
}

export function SectionErrorBoundary({ children, homePath, scopeLabel }: { children: ReactNode; homePath: string; scopeLabel: string }) {
  return (
    <RouteErrorBoundary homePath={homePath} preserveShell scopeLabel={scopeLabel}>
      {children}
    </RouteErrorBoundary>
  )
}

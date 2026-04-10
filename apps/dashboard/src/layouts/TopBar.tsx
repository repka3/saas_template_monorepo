import { ChevronDown, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/hooks/use-auth'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SidebarTrigger } from '@/components/ui/sidebar'

const getInitial = (value: string | null | undefined) => value?.trim().charAt(0).toUpperCase() || 'U'

export default function TopBar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  if (!user) {
    return null
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)

    await authClient.signOut()

    setIsSigningOut(false)
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-foreground/10 bg-background/82 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" />

      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">L</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">Fake Logo</p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button className="ml-auto min-w-0 gap-2 rounded-full px-2.5" variant="outline" />}>
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {getInitial(user.name || user.email)}
          </span>
          <span className="hidden max-w-32 truncate sm:block">{user.name || user.email}</span>
          <ChevronDown className="hidden text-muted-foreground sm:block" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={10}>
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={isSigningOut} onClick={handleSignOut}>
              <LogOut />
              <span>{isSigningOut ? 'Logging out' : 'Logout'}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

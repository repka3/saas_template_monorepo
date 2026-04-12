import { ChevronDown, KeyRound, LogOut, UserPen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useProfileQuery } from '@/features/profile/use-profile-query'
import { getProfileDisplayAvatarUrl, getProfileDisplayInitial, getProfileDisplayName } from '@/features/profile/profile-display'
import { useAuth } from '@/hooks/use-auth'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SidebarTrigger } from '@/components/ui/sidebar'

export default function TopBar() {
  const navigate = useNavigate()
  const { homePath, user } = useAuth()
  const { data } = useProfileQuery()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const profile = data?.user.profile ?? null
  const displayAvatar = user
    ? getProfileDisplayAvatarUrl(user, profile)
    : null

  useEffect(() => {
    setAvatarFailed(false)
  }, [displayAvatar])

  if (!user) {
    return null
  }

  const displayName = getProfileDisplayName(user, profile)
  const displayInitial = getProfileDisplayInitial(user, profile)

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
            {displayAvatar && !avatarFailed ? (
              <img alt={displayName} className="size-full rounded-full object-cover" src={displayAvatar} onError={() => setAvatarFailed(true)} />
            ) : (
              displayInitial
            )}
          </span>
          <span className="hidden max-w-32 truncate sm:block">{displayName}</span>
          <ChevronDown className="hidden text-muted-foreground sm:block" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={10}>
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link to={`${homePath}/profile`} />}>
              <UserPen />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/change-password" />}>
              <KeyRound />
              <span>Change password</span>
            </DropdownMenuItem>
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

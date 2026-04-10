import { House } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import TopBar from '@/layouts/TopBar'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from '@/components/ui/sidebar'

type RoleShellProps = {
  homePath: string
  roleLabel: string
}

export default function RoleShell({ homePath, roleLabel }: RoleShellProps) {
  const { pathname } = useLocation()

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="p-3">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/60 px-3 py-3">
            <p className="text-xs font-semibold tracking-[0.24em] text-sidebar-foreground/60 uppercase">Workspace</p>
            <p className="mt-1 text-sm font-semibold text-sidebar-foreground">{roleLabel}</p>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={pathname === homePath} render={<NavLink end to={homePath} />} tooltip="Home">
                    <House />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-svh bg-transparent">
        <TopBar />
        <div className="flex flex-1 p-4 pt-3 md:p-6 md:pt-4">
          <div className="flex flex-1 rounded-[1.75rem] border border-foreground/10 bg-background/88 p-5 shadow-xl shadow-slate-950/6 backdrop-blur md:p-8">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

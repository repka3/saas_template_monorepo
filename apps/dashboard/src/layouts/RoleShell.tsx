import type { LucideIcon } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import TopBar from '@/layouts/TopBar'
import { SectionErrorBoundary } from '@/routes/route-error-boundary'
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
  navItems: Array<{
    icon: LucideIcon
    label: string
    to: string
  }>
  roleLabel: string
}

export default function RoleShell({ homePath, navItems, roleLabel }: RoleShellProps) {
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
                {navItems.map((item) => {
                  const isActive = item.to === homePath ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)

                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton isActive={isActive} render={<NavLink end={item.to === homePath} to={item.to} />} tooltip={item.label}>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
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
            <SectionErrorBoundary homePath={homePath} scopeLabel={`${roleLabel} section`}>
              <Outlet />
            </SectionErrorBoundary>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

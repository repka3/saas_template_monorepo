import { House } from 'lucide-react'

import RoleShell from '@/layouts/RoleShell'

export default function UserLayout() {
  return <RoleShell homePath="/dashboard" navItems={[{ icon: House, label: 'Home', to: '/dashboard' }]} roleLabel="User" />
}

import { House, Users } from 'lucide-react'

import RoleShell from '@/layouts/RoleShell'

export default function SuperAdminLayout() {
  return (
    <RoleShell
      homePath="/superadmin"
      navItems={[
        { icon: House, label: 'Home', to: '/superadmin' },
        { icon: Users, label: 'Users', to: '/superadmin/users' },
      ]}
      roleLabel="Superadmin"
    />
  )
}

'use client'
import { TenantProfilePage } from '@/property-management-app'
import { useTenantPageProps } from '@/components/route-props'

export default function Page() {
  const { user, setUser } = useTenantPageProps()
  return <TenantProfilePage user={user} setUser={setUser} />
}

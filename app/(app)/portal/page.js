'use client'
import { TenantDashboard } from '@/property-management-app'
import { useTenantPageProps } from '@/components/route-props'

export default function Page() {
  const { data, user } = useTenantPageProps()
  return <TenantDashboard data={data} user={user} />
}

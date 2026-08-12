'use client'
import { TenantMaintenancePage } from '@/property-management-app'
import { useTenantPageProps } from '@/components/route-props'

export default function Page() {
  return <TenantMaintenancePage {...useTenantPageProps()} />
}

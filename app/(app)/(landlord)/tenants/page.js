'use client'
import { TenantsPage } from '@/property-management-app'
import { useLandlordPageProps } from '@/components/route-props'

export default function Page() {
  return <TenantsPage {...useLandlordPageProps()} />
}

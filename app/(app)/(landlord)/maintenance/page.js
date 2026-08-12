'use client'
import { MaintenancePage } from '@/property-management-app'
import { useLandlordPageProps } from '@/components/route-props'

export default function Page() {
  return <MaintenancePage {...useLandlordPageProps()} />
}

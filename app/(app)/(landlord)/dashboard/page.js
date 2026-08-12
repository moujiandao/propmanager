'use client'
import { LandlordDashboard } from '@/property-management-app'
import { useLandlordPageProps } from '@/components/route-props'

export default function Page() {
  return <LandlordDashboard {...useLandlordPageProps()} />
}

'use client'
import { ParkingPage } from '@/property-management-app'
import { useLandlordPageProps } from '@/components/route-props'

export default function Page() {
  return <ParkingPage {...useLandlordPageProps()} />
}

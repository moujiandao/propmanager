'use client'
import { PaymentsPage } from '@/property-management-app'
import { useLandlordPageProps } from '@/components/route-props'

export default function Page() {
  return <PaymentsPage {...useLandlordPageProps()} />
}

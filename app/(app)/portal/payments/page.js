'use client'
import { PaymentPortal } from '@/property-management-app'
import { useTenantPageProps } from '@/components/route-props'

export default function Page() {
  return <PaymentPortal {...useTenantPageProps()} />
}

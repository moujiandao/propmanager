'use client'
import { PaymentHistoryPage } from '@/property-management-app'
import { useTenantPageProps } from '@/components/route-props'

export default function Page() {
  const { data, user } = useTenantPageProps()
  return <PaymentHistoryPage data={data} user={user} />
}

'use client'
import { ContractsPage } from '@/property-management-app'
import { useLandlordPageProps } from '@/components/route-props'

// /leases, not /contracts: the table is `contracts` but the domain word — and
// the nav label — is Leases. URLs are user-facing; table names are not.
export default function Page() {
  return <ContractsPage {...useLandlordPageProps()} />
}

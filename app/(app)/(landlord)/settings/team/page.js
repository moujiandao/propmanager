'use client'
import { AdminUsersPage } from '@/property-management-app'
import { useLandlordPageProps } from '@/components/route-props'

export default function Page() {
  return <AdminUsersPage {...useLandlordPageProps()} />
}

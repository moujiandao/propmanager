'use client'
import { PropertiesPage } from '@/property-management-app'
import { useLandlordPageProps } from '@/components/route-props'

export default function Page() {
  return <PropertiesPage {...useLandlordPageProps()} />
}

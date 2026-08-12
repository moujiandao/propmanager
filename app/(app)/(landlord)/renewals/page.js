'use client'
import { RenewalsPage } from '@/renewal-components'
import { useLandlordPageProps } from '@/components/route-props'

export default function Page() {
  return <RenewalsPage {...useLandlordPageProps()} />
}

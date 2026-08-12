'use client'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { PropertyDetailPage } from '@/phase2-components'
import { useLandlordPageProps } from '@/components/route-props'
import { routes } from '@/lib/routes'

// The param is passed straight through as `propertyId` — the prop name
// PropertyDetailPage already takes — so the component needed no change.
export default function Page({ params }) {
  const { propertyId } = use(params)
  const router = useRouter()
  const { data, setData, refresh, user, t } = useLandlordPageProps()
  return (
    <PropertyDetailPage
      data={data} setData={setData} refresh={refresh} user={user} t={t}
      propertyId={propertyId}
      onBack={() => router.push(routes.properties())}
      onNavigateToTenant={(id) => router.push(routes.tenant(id))}
    />
  )
}

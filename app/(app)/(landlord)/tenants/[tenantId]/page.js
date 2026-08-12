'use client'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { TenantContactPage } from '@/phase2-components'
import { useLandlordPageProps } from '@/components/route-props'
import { routes } from '@/lib/routes'

export default function Page({ params }) {
  const { tenantId } = use(params)
  const router = useRouter()
  const { data, setData, refresh, user, t } = useLandlordPageProps()
  return (
    <TenantContactPage
      data={data} setData={setData} refresh={refresh} user={user} t={t}
      tenantId={tenantId}
      // Deliberately an "up" link to the list, not router.back(): after a
      // delete, onBack() fires and back() would return to the detail page of a
      // record that no longer exists.
      onBack={() => router.push(routes.tenants())}
      onNavigateToProperty={(id) => router.push(routes.property(id))}
    />
  )
}

'use client'
import { DocumentsPageV2 } from '@/phase2-components'
import { useLandlordPageProps } from '@/components/route-props'

export default function Page() {
  const { data, setData, refresh, user } = useLandlordPageProps()
  return <DocumentsPageV2 data={data} setData={setData} refresh={refresh} user={user} />
}

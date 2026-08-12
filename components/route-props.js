'use client'

import { T } from '@/lib/i18n/strings'
import { useAppUser, useAppLang, useAppData } from '@/components/app-store'

// The props bag that `renderPage()` used to build.
//
// Every page component kept its existing signature through the routing move, so
// each route file is a thin wrapper that spreads this. When a page eventually
// reads the store directly, delete its use of this rather than growing it.
export function useLandlordPageProps() {
  const { user } = useAppUser()
  const { lang } = useAppLang()
  const { data, setData, refresh } = useAppData()
  return { data, setData, t: T[lang], lang, refresh, user }
}

export function useTenantPageProps() {
  const { user, setUser } = useAppUser()
  const { data, setData, refresh } = useAppData()
  return { data, setData, user, setUser, refresh }
}

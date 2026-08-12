'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadAllData, EMPTY_DATA } from '@/lib/dashboard/load'

// The app's client store, hoisted out of `App()` so it can live in a layout.
//
// Why a layout: Next does not re-render a shared parent layout when navigating
// between its children, so state held here survives soft navigation between
// routes. That is the whole reason the URL migration doesn't have to refetch
// the portfolio on every click.
//
// Three contexts, deliberately split rather than one merged value. The sidebar
// and every page consume these; a single context would re-render all of them on
// every `setData`. There is no React Compiler in this build (see CLAUDE.md), so
// nothing absorbs that for us.
const UserContext = createContext(null)
const LangContext = createContext(null)
const DataContext = createContext(null)

export const useAppUser = () => useContext(UserContext)
export const useAppLang = () => useContext(LangContext)
export const useAppData = () => useContext(DataContext)

const supabase = createClient()

const loadingScreen = (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", color: "#6b7280", fontSize: 16 }}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); -webkit-font-smoothing: antialiased;`}</style>
    Loading your portfolio…
  </div>
)

// `initialUser` is resolved on the server (lib/auth/current-user). The client no
// longer probes landlord_members/tenant_profiles itself, which removes two
// sequential round trips from the cold path and the null-render that gated them.
export function AppProvider({ initialUser, children }) {
  const [user, setUser] = useState(initialUser)
  const [data, setData] = useState(EMPTY_DATA)
  const [loadingData, setLoadingData] = useState(false)
  // Distinct from `!loadingData`: false until the first load *settles*, so a
  // consumer can tell "still loading" from "loaded, and the record isn't there".
  const [dataLoaded, setDataLoaded] = useState(false)

  // Read the stored language during the first render, not in an effect. Reading
  // it afterwards meant every load painted "zh" and then corrected itself.
  const [lang, setLang] = useState(() =>
    (typeof window !== 'undefined' && localStorage.getItem('propmanager_lang')) || 'zh'
  )
  useEffect(() => { localStorage.setItem('propmanager_lang', lang) }, [lang])

  useEffect(() => { document.body.style.margin = '0'; document.body.style.background = '#fafafa' }, [])

  const refresh = async () => {
    if (!user?.role) return
    setLoadingData(true)
    try {
      setData(await loadAllData(supabase, user))
    } catch (err) {
      // Keep whatever is already on screen rather than blanking the app. The
      // error boundary added with the routes handles the cold-start case.
      console.error('loadAllData error:', err)
    }
    setDataLoaded(true)
    setLoadingData(false)
  }

  useEffect(() => { if (user?.role) refresh() }, [user?.id, user?.role])

  // The server layout owns "is there a session?". This only has to catch a sign
  // out that happens while the app is open (including in another tab).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') window.location.href = '/'
    })
    return () => subscription.unsubscribe()
  }, [])

  // The cold gate lives INSIDE the provider, replacing `children`. It must not
  // wrap the provider — `{cold ? <Spinner/> : <AppProvider>…}` would remount the
  // provider every time the flag flipped, wiping the store and every optimistic
  // update. Same condition as before: a post-mutation refresh over populated
  // data stays invisible.
  const cold = loadingData && !data.properties.length && !data.tenants.length

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <LangContext.Provider value={{ lang, setLang }}>
        <DataContext.Provider value={{ data, setData, loadingData, dataLoaded, refresh }}>
          {cold ? loadingScreen : children}
        </DataContext.Provider>
      </LangContext.Provider>
    </UserContext.Provider>
  )
}

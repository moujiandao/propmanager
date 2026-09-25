'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadAllData, EMPTY_DATA } from '@/lib/dashboard/load'
import { T } from '@/lib/i18n/strings'

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

function loadErrorScreen({ t, onRetry, loading }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#fafafa", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      <div style={{ width: "min(100%, 440px)", background: "#fff", border: "1px solid #eaeaea", borderRadius: 14, padding: 28, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
        <h1 style={{ margin: "0 0 10px", color: "#111111", fontSize: 20 }}>{t.dataLoadErrorTitle}</h1>
        <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: 14, lineHeight: 1.5 }}>{t.dataLoadErrorDetail}</p>
        <button onClick={onRetry} disabled={loading} style={{ background: "#111111", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", font: "600 14px inherit", cursor: loading ? "wait" : "pointer", opacity: loading ? .65 : 1 }}>
          {loading ? t.dataLoadRetrying : t.dataLoadRetry}
        </button>
      </div>
    </div>
  )
}

function refreshErrorBanner({ t, onRetry, loading }) {
  return (
    <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", background: "#fff7ed", borderBottom: "1px solid #fed7aa", color: "#9a3412", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", fontSize: 13 }}>
      <span>{t.dataLoadErrorDetail}</span>
      <button onClick={onRetry} disabled={loading} style={{ flexShrink: 0, background: "transparent", color: "#9a3412", border: "1px solid #fdba74", borderRadius: 7, padding: "6px 10px", font: "600 13px inherit", cursor: loading ? "wait" : "pointer", opacity: loading ? .65 : 1 }}>
        {loading ? t.dataLoadRetrying : t.dataLoadRetry}
      </button>
    </div>
  )
}

// `initialUser` is resolved on the server (lib/auth/current-user). The client no
// longer probes landlord_members/tenant_profiles itself, which removes two
// sequential round trips from the cold path and the null-render that gated them.
export function AppProvider({ initialUser, children }) {
  const [user, setUser] = useState(initialUser)
  const [data, setData] = useState(EMPTY_DATA)
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState(null)
  const [hasSuccessfulLoad, setHasSuccessfulLoad] = useState(false)
  const refreshSequence = useRef(0)
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
    const sequence = ++refreshSequence.current
    setLoadingData(true)
    setDataError(null)
    try {
      const nextData = await loadAllData(supabase, user)
      if (sequence !== refreshSequence.current) return
      setData(nextData)
      setHasSuccessfulLoad(true)
    } catch (err) {
      if (sequence !== refreshSequence.current) return
      // Keep whatever is already on screen rather than blanking the app. The
      // first-load screen offers an explicit retry, while a later failure leaves
      // the successful portfolio visible with a retry banner.
      console.error('loadAllData error:', err)
      setDataError(err)
    } finally {
      if (sequence !== refreshSequence.current) return
      setDataLoaded(true)
      setLoadingData(false)
    }
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
  // update. `hasSuccessfulLoad` also distinguishes a legitimately empty
  // portfolio from an initial read that failed before returning any data.
  const cold = !hasSuccessfulLoad && !dataError
  const initialLoadFailed = !hasSuccessfulLoad && Boolean(dataError)
  const t = T[lang] || T.en

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <LangContext.Provider value={{ lang, setLang }}>
        <DataContext.Provider value={{ data, setData, loadingData, dataLoaded, dataError, refresh }}>
          {cold
            ? loadingScreen
            : initialLoadFailed
              ? loadErrorScreen({ t, onRetry: refresh, loading: loadingData })
              : <>{dataError && refreshErrorBanner({ t, onRetry: refresh, loading: loadingData })}{children}</>}
        </DataContext.Provider>
      </LangContext.Provider>
    </UserContext.Provider>
  )
}

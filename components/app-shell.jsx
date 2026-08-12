'use client'

import { Sidebar } from '@/components/sidebar'

// The chrome every authed page sits inside. This used to be the JSX at the
// bottom of App(); it lives in a layout now so the sidebar is not torn down and
// rebuilt on every navigation.
export function AppShell({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; } body { margin: 0; -webkit-font-smoothing: antialiased; }`}</style>
      <Sidebar />
      <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  )
}

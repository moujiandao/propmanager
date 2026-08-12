'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { routes } from '@/lib/routes'

// The app's first error boundary. Before routing there was nowhere to put one:
// a single page component either rendered or the whole surface went blank, and
// the read path logged failures to console.error and left the UI on stale data.
//
// Deliberately does NOT use the T object or the app store — if the provider is
// what threw, anything reading its context would throw again inside the
// boundary. That is why this copy is bilingual inline rather than via `t`.
export default function AppError({ error, reset }) {
  useEffect(() => { console.error('[app error boundary]', error) }, [error])

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", padding: 40 }}>
      <div style={{ background: "#fff", border: "1px solid #eaeaea", borderRadius: 14, padding: 32, maxWidth: 460, textAlign: "center" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#111111" }}>Something went wrong. 出错了。</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
          This page failed to load. Try again, or go back to the dashboard.<br />
          此页面加载失败。请重试，或返回控制台。
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={reset} style={{ padding: "10px 20px", background: "#111111", border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Try again / 重试
          </button>
          <Link href={routes.dashboard()} style={{ padding: "10px 20px", background: "#fff", border: "1px solid #eaeaea", borderRadius: 9, color: "#6b7280", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>
            Dashboard / 控制台
          </Link>
        </div>
      </div>
    </div>
  )
}

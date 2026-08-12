import Link from 'next/link'
import { routes } from '@/lib/routes'

// Reachable for the first time now that app URLs are things a human can type or
// bookmark. Bilingual inline for the same reason as error.js: a not-found can
// render outside the provider, so it cannot depend on the language store.
export default function AppNotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", padding: 40 }}>
      <div style={{ background: "#fff", border: "1px solid #eaeaea", borderRadius: 14, padding: 32, maxWidth: 460, textAlign: "center" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#111111" }}>Page not found. 未找到页面。</h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
          That URL doesn&apos;t match anything in the app.<br />该网址在应用中不存在。
        </p>
        <Link href={routes.dashboard()} style={{ display: "inline-block", padding: "10px 20px", background: "#111111", border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>
          Back to dashboard / 返回控制台
        </Link>
      </div>
    </div>
  )
}

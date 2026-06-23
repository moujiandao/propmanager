import Link from 'next/link'
import { Logo } from '../_brand'
import { palette, container, btnStyle } from '@/lib/theme'

export default function MarketingLayout({ children }) {
  return (
    <div style={{ background: palette.bg, color: palette.text, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </div>
  )
}

function Header() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: `1px solid ${palette.border}`,
      }}
    >
      <div style={{ ...container, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/#features" style={navLink}>Features</Link>
          <Link href="/pricing" style={navLink}>Pricing</Link>
          <Link href="/login" style={navLink}>Log in</Link>
          <Link href="/signup" style={btnStyle('primary', 'md')}>Start for free</Link>
        </nav>
      </div>
    </header>
  )
}

const navLink = { color: palette.text, textDecoration: 'none', fontSize: 15, fontWeight: 500 }

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${palette.border}`, background: palette.bgSubtle }}>
      <div style={{ ...container, padding: '40px 24px', display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo size={26} />
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/#features" style={{ ...navLink, color: palette.textMuted, fontSize: 14 }}>Features</Link>
          <Link href="/pricing" style={{ ...navLink, color: palette.textMuted, fontSize: 14 }}>Pricing</Link>
          <Link href="/login" style={{ ...navLink, color: palette.textMuted, fontSize: 14 }}>Log in</Link>
        </div>
        <span style={{ color: palette.textFaint, fontSize: 13 }}>© {new Date().getFullYear()} PropManager</span>
      </div>
    </footer>
  )
}

import Link from 'next/link'
import { Logo } from '../_brand'
import { palette } from '@/lib/theme'

export default function AuthLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: palette.bgSubtle, color: palette.text, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 28px' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 20px 60px' }}>
        {children}
      </div>
    </div>
  )
}

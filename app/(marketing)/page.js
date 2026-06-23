import Link from 'next/link'
import { palette, container, btnStyle, radius } from '@/lib/theme'

export const metadata = {
  title: 'PropManager — Property management, simplified',
  description:
    'Lease renewals, e-signature sending, automated tenant reminders, and maintenance — all in one clean, modern platform for landlords.',
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <ClosingCta />
    </>
  )
}

/* ─── Hero ─────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section
      style={{
        background: `linear-gradient(180deg, ${palette.bgTint} 0%, ${palette.bg} 70%)`,
        borderBottom: `1px solid ${palette.border}`,
        paddingTop: 80,
        paddingBottom: 0,
      }}
    >
      <div style={{ ...container, textAlign: 'center' }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 13,
            fontWeight: 600,
            color: palette.blue,
            background: '#fff',
            border: `1px solid ${palette.border}`,
            borderRadius: radius.pill,
            padding: '6px 14px',
            marginBottom: 24,
          }}
        >
          The all-in-one platform for modern landlords
        </span>
        <h1
          style={{
            fontSize: 'clamp(40px, 6vw, 72px)',
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: '0 auto 22px',
            maxWidth: 860,
          }}
        >
          Property management,<br />simplified.
        </h1>
        <p
          style={{
            fontSize: 'clamp(17px, 2vw, 21px)',
            color: palette.textMuted,
            lineHeight: 1.5,
            maxWidth: 620,
            margin: '0 auto 32px',
          }}
        >
          Renew leases, send documents for signature, automate tenant reminders, and
          handle maintenance — all from one clean dashboard.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
          <Link href="/signup" className="pm-btn" style={btnStyle('primary', 'lg')}>Start for free</Link>
          <Link href="/pricing" className="pm-btn" style={btnStyle('secondary', 'lg')}>See pricing</Link>
        </div>
        <ProductMock />
      </div>
    </section>
  )
}

// A stylized, static product preview built from divs (no screenshot dependency).
function ProductMock() {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: '0 auto',
        transform: 'translateY(1px)',
        borderRadius: `${radius.lg}px ${radius.lg}px 0 0`,
        border: `1px solid ${palette.border}`,
        borderBottom: 'none',
        background: '#fff',
        boxShadow: '0 24px 60px rgba(17,17,17,0.10)',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      {/* window chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 16px', borderBottom: `1px solid ${palette.borderSoft}` }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
        ))}
        <span style={{ marginLeft: 12, fontSize: 12, color: palette.textFaint }}>app.propmanager.com/dashboard</span>
      </div>
      <div style={{ display: 'flex', minHeight: 300 }}>
        {/* sidebar */}
        <div style={{ width: 168, background: palette.text, padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['Dashboard', 'Properties', 'Tenants', 'Renewals', 'Maintenance', 'Documents'].map((label, i) => (
            <div
              key={label}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: i === 0 ? '#fff' : 'rgba(255,255,255,0.55)',
                background: i === 0 ? 'rgba(255,255,255,0.12)' : 'transparent',
                padding: '8px 10px',
                borderRadius: 8,
              }}
            >
              {label}
            </div>
          ))}
        </div>
        {/* content */}
        <div style={{ flex: 1, padding: 24, background: palette.bgSubtle }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
            {[['Occupied units', '24 / 26'], ['Rent collected', '$48,200'], ['Open requests', '3']].map(([label, value]) => (
              <div key={label} style={{ flex: 1, background: '#fff', border: `1px solid ${palette.border}`, borderRadius: radius.md, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, color: palette.textMuted, marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: `1px solid ${palette.border}`, borderRadius: radius.md, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Upcoming lease renewals</div>
            {[['Unit 4B · Maria Chen', 'Sent for signature', '#2f6fed'], ['Unit 2A · James Park', 'Awaiting review', '#f59e0b'], ['Unit 7C · Otto Reyes', 'Signed', '#22c55e']].map(([who, status, color]) => (
              <div key={who} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${palette.borderSoft}` }}>
                <span style={{ fontSize: 13, color: palette.text }}>{who}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color, background: `${color}18`, padding: '3px 10px', borderRadius: radius.pill }}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Features ─────────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: 'refresh',
    title: 'Lease renewals',
    body: 'See every lease coming due, prepare new terms in a click, and keep an audit trail of every renewal — no spreadsheets, no missed dates.',
  },
  {
    icon: 'signature',
    title: 'Send PDFs for signature',
    body: 'Generate renewal and lease documents and send them for e-signature automatically. Tenants sign online; you get the countersigned PDF back.',
  },
  {
    icon: 'bell',
    title: 'Automated tenant reminders',
    body: 'Rent reminders, move-out notices, and follow-ups send themselves on the schedule you set — with human review before anything goes out.',
  },
  {
    icon: 'wrench',
    title: 'Maintenance requests',
    body: 'Tenants submit requests with photos; you triage, comment, and resolve from one place. Everyone stays in the loop, in English or Chinese.',
  },
]

function Features() {
  return (
    <section id="features" style={{ padding: '96px 0' }}>
      <div style={container}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 56px' }}>
          <h2 style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            Everything you need to run your properties
          </h2>
          <p style={{ fontSize: 18, color: palette.textMuted, lineHeight: 1.5, margin: 0 }}>
            Built for landlords who want the leasing busywork to handle itself.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ icon, title, body }) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        padding: '28px 26px',
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: radius.md,
          background: palette.bgTint,
          color: palette.blue,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        }}
      >
        <FeatureIcon name={icon} />
      </div>
      <h3 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 10px' }}>{title}</h3>
      <p style={{ fontSize: 15, color: palette.textMuted, lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
  )
}

function FeatureIcon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    refresh: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
    signature: <><path d="M3 17c3-1 4-6 6-6s2 4 4 4 2-3 5-3" /><path d="M3 21h18" /></>,
    bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    wrench: <path d="M14.7 6.3a4 4 0 0 0 5 5l-9 9a2.83 2.83 0 1 1-4-4l9-9a4 4 0 0 0-1-1z" />,
  }
  return <svg {...common}>{paths[name]}</svg>
}

/* ─── Closing CTA ──────────────────────────────────────────────────────────── */
function ClosingCta() {
  return (
    <section style={{ padding: '0 24px 96px' }}>
      <div
        style={{
          ...container,
          background: palette.text,
          color: '#fff',
          borderRadius: 24,
          padding: 'clamp(48px, 7vw, 80px) 32px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
          Start managing the easy way
        </h2>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', margin: '0 0 28px' }}>
          Free to get started. No credit card required.
        </p>
        <Link href="/signup" className="pm-btn" style={{ ...btnStyle('secondary', 'lg'), background: '#fff' }}>
          Create your free account
        </Link>
      </div>
    </section>
  )
}

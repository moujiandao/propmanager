import Link from 'next/link'
import { palette, container, btnStyle, radius } from '@/lib/theme'

export const metadata = {
  title: 'PropManager — Move-in and move-out tracking for high-turnover rentals',
  description:
    'For student, seasonal, and short-term rentals. See every move-in and move-out for the next six months, catch vacancy gaps early, and confirm each turnover yourself.',
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <Turnover />
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
          Built for high-turnover rentals
        </span>
        {/* No hardcoded <br />: the previous headline forced the same break at every
            width. `balance` keeps the two lines even without pinning where they fall. */}
        <h1
          style={{
            fontSize: 'clamp(40px, 6vw, 72px)',
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: '0 auto 22px',
            maxWidth: 780,
            textWrap: 'balance',
          }}
        >
          Move-ins, move-outs, nothing dropped.
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
          Tenant status updates itself from move-in and move-out dates. You just
          confirm what actually happened.
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
// It shows Unit Transitions rather than a rent roll: that panel is the thing this
// product does that general property software doesn't, so it is what the hero
// should be a picture of.
const MOCK_NAV = ['Dashboard', 'Properties', 'Tenants', 'Payments', 'To Do List', 'Renewals']

const MOCK_STATS = [
  ['Occupied units', '22 / 26'],
  ['Move-ins next 30 days', '7'],
  ['Units to rent out', '3'],
]

const MOCK_ROWS = [
  ['Unit 4B', '2 moving out · Aug 31', 'Confirm move-out', palette.blue],
  ['Unit 2A', '1 moving in · Oct 3', 'Gap 1mo 12d', '#f59e0b'],
  ['Unit 7C', '2 moving out · Sep 30', 'Need to find new tenant(s)', '#ef4444'],
]

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
        {/* sidebar — hidden below 640px, where 168 fixed pixels of chrome would
            leave the panel it frames unreadable. `display` is deliberately NOT set
            here: it lives on .pm-mock-sidebar in globals.css, because an inline
            display would outrank the stylesheet and the media query could never
            hide it. Same reasoning as the hover rules' comment in that file. */}
        <div className="pm-mock-sidebar" style={{ width: 168, flexShrink: 0, background: palette.text, padding: '18px 14px', flexDirection: 'column', gap: 6 }}>
          {MOCK_NAV.map((label, i) => (
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
        <div style={{ flex: 1, minWidth: 0, padding: 24, background: palette.bgSubtle }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
            {MOCK_STATS.map(([label, value]) => (
              <div key={label} style={{ flex: '1 1 150px', background: '#fff', border: `1px solid ${palette.border}`, borderRadius: radius.md, padding: '16px 18px' }}>
                <div style={{ fontSize: 12, color: palette.textMuted, marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: `1px solid ${palette.border}`, borderRadius: radius.md, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Unit Transitions — Next 6 Months</div>
            {MOCK_ROWS.map(([unit, detail, status, color]) => (
              <div key={unit} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${palette.borderSoft}` }}>
                <span style={{ fontSize: 13, color: palette.text }}>
                  <strong style={{ fontWeight: 600 }}>{unit}</strong>
                  <span style={{ color: palette.textMuted }}> · {detail}</span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color, background: `${color}18`, padding: '3px 10px', borderRadius: radius.pill, whiteSpace: 'nowrap' }}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── How one turnover goes ────────────────────────────────────────────────── */
const STEPS = [
  {
    title: 'Notice arrives',
    body: 'You enter the move-out date, and Unit 4B shows up under Unit Transitions with the date it comes free.',
  },
  {
    title: 'Nobody incoming yet',
    body: 'Until someone is booked, the unit carries a red “Need to find new tenant(s)” so an empty September can’t sneak up on you.',
  },
  {
    title: 'Lease and housemates',
    body: 'Upload the signed lease and every housemate is created as a separate tenant with their own rent, each marked “Security Deposit not received” until the money lands. No logins to set up unless you want them.',
  },
  {
    title: 'Clean, then confirm',
    body: 'The unit shows “Clean unit before Sep 1” and “Gap 12d”, and it stays on the list until you press “Tenants have moved out” and “Tenants have moved in”.',
  },
]

function Turnover() {
  return (
    <section style={{ padding: '96px 0 0' }}>
      <div style={container}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 48px' }}>
          <h2 style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            How one turnover goes
          </h2>
          <p style={{ fontSize: 18, color: palette.textMuted, lineHeight: 1.5, margin: 0 }}>
            One unit, from the day notice arrives to the day the next tenants get their keys.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 20 }}>
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              style={{
                background: palette.bgSubtle,
                border: `1px solid ${palette.border}`,
                borderRadius: radius.lg,
                padding: '26px 24px',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: palette.blue, letterSpacing: '0.06em', marginBottom: 12 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 10px' }}>{s.title}</h3>
              <p style={{ fontSize: 15, color: palette.textMuted, lineHeight: 1.55, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Features ─────────────────────────────────────────────────────────────── */
// Ordered so the turnover-specific capabilities lead. Deliberately absent: rent
// collection (the tenant ACH path is not wired up end to end) and the Payment
// Reminders screen (it stores settings but nothing sends them — the date-anchored
// email automations in card 5 are the mechanism that actually sends).
const FEATURES = [
  {
    icon: 'swap',
    title: 'Unit Transitions',
    body: 'The dashboard lists every move-in and move-out for the next six months, one line per unit. Each one stays on the list until you press “Tenants have moved in” or “Tenants have moved out”, so a no-show never quietly becomes a resident.',
  },
  {
    icon: 'calendar',
    title: 'Status from dates',
    body: 'A tenant is upcoming, current, or past based on their move-in and move-out dates — there is no status field to forget to update. Change a date and every list, count, and vacancy warning changes with it.',
  },
  {
    icon: 'clock',
    title: 'Gaps and cleaning windows',
    body: 'Each unit shows the gap between the last move-out and the next move-in — “Gap 1mo 12d” — plus “Clean unit before Sep 1” when one group leaves and another arrives. A daily briefing sums up the coming move-ins, move-outs and vacancies.',
  },
  {
    icon: 'users',
    title: 'Housemates and deposits',
    body: 'Upload a lease PDF and every housemate becomes their own tenant, with their own rent inside the shared unit. Deposits stay flagged “not received” until you mark them, and refunds are tracked on the way out.',
  },
  {
    icon: 'bell',
    title: 'Emails on the date',
    body: 'Set emails to send a chosen number of days before or after a move-in, move-out, lease end, or rent due date. They go out once a day, never twice to the same tenant, and you can hold a batch for review before it sends.',
  },
  {
    icon: 'wrench',
    title: 'Maintenance, EN and 中文',
    body: 'Tenants submit requests with photos; you move them across a board, reply in a thread, and close them out. The landlord console runs in 中文 by default, and requests written in English are translated for you.',
  },
]

function Features() {
  return (
    <section id="features" style={{ padding: '96px 0' }}>
      <div style={container}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 56px' }}>
          <h2 style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            Built around the turnover, not the lease
          </h2>
          <p style={{ fontSize: 18, color: palette.textMuted, lineHeight: 1.5, margin: 0 }}>
            Most property software assumes tenants stay for years. This one assumes they don’t.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 20 }}>
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

// Paths are inlined rather than imported from the app's shared Icon component:
// that one lives in property-management-app.jsx, which is 'use client' and would
// drag the whole dashboard bundle onto this page. An unknown name renders an
// empty <svg>, so every name used in FEATURES must exist here.
function FeatureIcon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    swap: <><path d="M7 4 3 8l4 4" /><path d="M3 8h13a4 4 0 0 1 0 8h-1" /><path d="m17 20 4-4-4-4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    users: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="3.5" /><path d="M17 4.5a3.5 3.5 0 0 1 0 6.8" /><path d="M22 20v-2a4 4 0 0 0-3-3.8" /></>,
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
          Get ahead of the next move-out
        </h2>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', margin: '0 0 28px' }}>
          Put in your move-out dates and see the next six months. Free to start, no credit card.
        </p>
        <Link href="/signup" className="pm-btn" style={{ ...btnStyle('secondary', 'lg'), background: '#fff' }}>
          Start for free
        </Link>
      </div>
    </section>
  )
}

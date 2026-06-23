import Link from 'next/link'
import { palette, container, btnStyle, radius } from '@/lib/theme'

export const metadata = {
  title: 'Pricing — PropManager',
  description: 'Simple, flat pricing for landlords. Start free, upgrade as your portfolio grows.',
}

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    blurb: 'For landlords just getting started.',
    cta: 'Start for free',
    highlighted: false,
    features: [
      'Up to 3 units',
      'Properties, tenants & leases',
      'Rent tracking',
      'Maintenance requests',
    ],
  },
  {
    name: 'Pro',
    price: '$29',
    cadence: 'per month',
    blurb: 'For growing portfolios that want automation.',
    cta: 'Choose Pro',
    highlighted: true,
    featuresLabel: 'Everything in Free, plus:',
    features: [
      'Up to 25 units',
      'Lease renewals',
      'Send PDFs for e-signature',
      'Automated tenant reminders',
      'Email automation with review',
    ],
  },
  {
    name: 'Business',
    price: '$79',
    cadence: 'per month',
    blurb: 'For larger operators and teams.',
    cta: 'Choose Business',
    highlighted: false,
    featuresLabel: 'Everything in Pro, plus:',
    features: [
      'Unlimited units',
      'Team members',
      'Bilingual tenant portal',
      'Priority support',
    ],
  },
]

export default function PricingPage() {
  return (
    <section style={{ padding: '80px 0 96px' }}>
      <div style={container}>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 56px' }}>
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 18px' }}>
            A plan for every portfolio
          </h1>
          <p style={{ fontSize: 19, color: palette.textMuted, lineHeight: 1.5, margin: 0 }}>
            Start free and upgrade as you grow. No credit card to begin.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22, alignItems: 'start', maxWidth: 980, margin: '0 auto' }}>
          {TIERS.map((tier) => (
            <PlanCard key={tier.name} tier={tier} />
          ))}
        </div>

        <p style={{ textAlign: 'center', color: palette.textFaint, fontSize: 14, marginTop: 40 }}>
          Prices in USD. Paid plans are billed monthly and can be cancelled anytime.
        </p>

        <Faq />
      </div>
    </section>
  )
}

const FAQS = [
  {
    q: 'Is the Free plan really free?',
    a: 'Yes — Free is free forever for up to 3 units, with no credit card required to start.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Anytime. Upgrade as your portfolio grows, or downgrade if your needs change.',
  },
  {
    q: 'What counts as a unit?',
    a: 'Each rentable unit you manage — a single-family home is one unit, a fourplex is four.',
  },
  {
    q: 'Do my tenants pay to use it?',
    a: 'No. Tenants use the portal for free to pay rent, submit maintenance requests, and manage their profile.',
  },
  {
    q: 'How do tenant accounts work?',
    a: 'You create tenant accounts from your dashboard — tenants do not sign up on their own.',
  },
]

function Faq() {
  return (
    <div style={{ maxWidth: 760, margin: '88px auto 0' }}>
      <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 36px' }}>
        Frequently asked questions
      </h2>
      <div>
        {FAQS.map(({ q, a }) => (
          <div key={q} style={{ padding: '22px 0', borderTop: `1px solid ${palette.border}` }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>{q}</h3>
            <p style={{ fontSize: 15, color: palette.textMuted, lineHeight: 1.55, margin: 0 }}>{a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanCard({ tier }) {
  const { name, price, cadence, blurb, cta, highlighted, features, featuresLabel } = tier
  return (
    <div
      style={{
        position: 'relative',
        background: '#fff',
        border: highlighted ? `2px solid ${palette.blue}` : `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        padding: highlighted ? '34px 28px' : '34px 28px',
        boxShadow: highlighted ? '0 16px 44px rgba(47,111,237,0.14)' : 'none',
      }}
    >
      {highlighted && (
        <span
          style={{
            position: 'absolute',
            top: -13,
            left: '50%',
            transform: 'translateX(-50%)',
            background: palette.blue,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.02em',
            padding: '5px 14px',
            borderRadius: radius.pill,
          }}
        >
          Most popular
        </span>
      )}
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>{name}</h2>
      <p style={{ fontSize: 14, color: palette.textMuted, minHeight: 40, margin: '0 0 18px' }}>{blurb}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 22 }}>
        <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em' }}>{price}</span>
        <span style={{ fontSize: 15, color: palette.textMuted }}>{cadence}</span>
      </div>
      <Link href="/signup" className="pm-btn" style={{ ...btnStyle(highlighted ? 'blue' : 'secondary', 'md'), width: '100%' }}>
        {cta}
      </Link>
      {featuresLabel && (
        <p style={{ fontSize: 13, fontWeight: 600, color: palette.text, margin: '26px 0 12px' }}>{featuresLabel}</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: featuresLabel ? 0 : '26px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {features.map((f) => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: palette.textMuted }}>
            <Check />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={palette.blue} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

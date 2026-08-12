import { palette } from '@/lib/theme'

// Shared brand mark for marketing + auth surfaces. Server component (pure markup).
export function Logo({ size = 30, withWordmark = true, color = palette.text }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.3,
          background: palette.accent,
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
          <path d="M10 21v-6h4v6" />
        </svg>
      </span>
      {/* The wordmark drops out below 640px (.pm-wordmark in globals.css). The
          header is logo + nav on one row, and at ~375px the wordmark's 130px was
          enough to push the CTA off-screen and make the whole page scroll
          sideways. Note `display` is left to the stylesheet, not set inline, or
          the media query could not override it. */}
      {withWordmark && (
        <span className="pm-wordmark" style={{ fontSize: size * 0.62, fontWeight: 800, letterSpacing: '-0.02em', color }}>
          PropManager
        </span>
      )}
    </span>
  )
}

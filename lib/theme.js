// Shared design tokens for the public marketing + auth surfaces.
// Plain JS (no 'use client') so both server and client components can import it
// without dragging the client monolith (property-management-app.jsx) into their
// bundle. Mirrors the in-app `theme` object at the top of property-management-app.jsx.
export const palette = {
  text: '#111111',      // headings / primary text
  textMuted: '#6b7280', // body / descriptions
  textFaint: '#9ca3af', // labels / meta
  border: '#eaeaea',    // hairline borders
  borderSoft: '#f0f0f0',
  accent: '#111111',    // buttons / links
  accentHover: '#000000',
  bg: '#ffffff',
  bgSubtle: '#fafafa',  // section bands
  bgTint: '#f5f7ff',    // faint blue wash (Airtable-style highlight)
  blue: '#2f6fed',      // accent used sparingly for highlighted plan
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

// Centered content column, matches Airtable's roomy gutters.
export const container = { width: '100%', maxWidth: 1120, margin: '0 auto', padding: '0 24px' };

// Shared button styles for marketing/auth pages (the in-app Btn lives in the
// monolith; we keep these standalone to avoid importing a client component).
export function btnStyle(variant = 'primary', size = 'md') {
  const sizes = {
    md: { padding: '11px 20px', fontSize: 15 },
    lg: { padding: '14px 26px', fontSize: 16 },
  };
  const variants = {
    primary: { background: palette.accent, color: '#fff', border: `1px solid ${palette.accent}` },
    secondary: { background: '#fff', color: palette.text, border: `1px solid ${palette.border}` },
    blue: { background: palette.blue, color: '#fff', border: `1px solid ${palette.blue}` },
  };
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: radius.pill, fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
    fontFamily: 'inherit', lineHeight: 1, whiteSpace: 'nowrap', transition: 'opacity .15s',
    ...sizes[size], ...variants[variant],
  };
}

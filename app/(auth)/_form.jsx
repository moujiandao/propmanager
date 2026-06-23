import { palette, radius } from '@/lib/theme'

// Shared presentational pieces for the login + signup forms.
export function AuthCard({ title, subtitle, children }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        background: '#fff',
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        padding: 36,
        boxShadow: '0 4px 24px rgba(17,17,17,0.05)',
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 15, color: palette.textMuted, margin: '0 0 24px' }}>{subtitle}</p>}
      {children}
    </div>
  )
}

export function Field({ label, type = 'text', value, onChange, onKeyDown, autoFocus, autoComplete }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: palette.text, marginBottom: 6 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        style={{
          width: '100%',
          padding: '11px 14px',
          background: '#fff',
          border: `1px solid ${palette.border}`,
          borderRadius: radius.sm,
          color: palette.text,
          fontSize: 15,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    </label>
  )
}

export function SubmitButton({ children, onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%',
        padding: '13px',
        background: palette.accent,
        color: '#fff',
        border: 'none',
        borderRadius: radius.sm,
        fontSize: 15,
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        fontFamily: 'inherit',
        marginTop: 4,
      }}
    >
      {children}
    </button>
  )
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null
  const styles = {
    error: { color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca' },
    success: { color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0' },
  }
  return (
    <p style={{ fontSize: 13.5, padding: '10px 14px', borderRadius: radius.sm, margin: '0 0 16px', ...styles[kind] }}>
      {children}
    </p>
  )
}

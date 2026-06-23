'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { palette } from '@/lib/theme'
import { AuthCard, Field, SubmitButton, Alert } from '../_form'

const supabase = createClient()

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    // Resolve the account's role before navigating, so a session with no profile
    // gets a clear error here instead of bouncing off the dashboard guard.
    // Landlords and tenants log in the same way; the dashboard renders the right
    // surface based on the resolved role.
    const { data: membership } = await supabase
      .from('landlord_members')
      .select('landlord_id')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle()
    if (membership) return go()

    const { data: tenant } = await supabase
      .from('tenant_profiles')
      .select('id')
      .eq('id', authData.user.id)
      .maybeSingle()
    if (tenant) return go()

    await supabase.auth.signOut()
    setError('No profile found for this account.')
    setLoading(false)
  }

  // Full navigation (not router.push) so the server-side dashboard guard runs
  // with the freshly written session cookie. Only same-origin absolute paths are
  // honored: reject protocol-relative (`//host`) and external URLs to avoid an
  // open redirect via the `next` param.
  const go = () => {
    const next = new URLSearchParams(window.location.search).get('next') || '/dashboard'
    const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
    window.location.href = safe
  }

  return (
    <AuthCard title="Welcome back" subtitle="Log in to your PropManager account.">
      <Alert>{error}</Alert>
      <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
      <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
      <SubmitButton onClick={handleLogin} loading={loading}>
        {loading ? 'Signing in…' : 'Log in'}
      </SubmitButton>

      <p style={{ textAlign: 'center', fontSize: 14, color: palette.textMuted, margin: '20px 0 6px' }}>
        New to PropManager?{' '}
        <Link href="/signup" style={{ color: palette.text, fontWeight: 600, textDecoration: 'none' }}>Start for free</Link>
      </p>
      <p style={{ textAlign: 'center', fontSize: 13, color: palette.textFaint, margin: 0 }}>
        Tenants: use the email and password your landlord set up for you.
      </p>
    </AuthCard>
  )
}

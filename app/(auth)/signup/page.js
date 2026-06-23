'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { palette } from '@/lib/theme'
import { AuthCard, Field, SubmitButton, Alert } from '../_form'

const supabase = createClient()

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    setError('')
    if (!name.trim()) return setError('Full name is required.')
    if (!email.trim()) return setError('Email is required.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setLoading(true)
    const res = await fetch('/api/auth/register-landlord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Auto sign-in so "Start for free" lands the new landlord straight in the app.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) {
      // Account exists but auto sign-in failed — send them to log in manually.
      window.location.href = '/login'
      return
    }
    window.location.href = '/dashboard'
  }

  return (
    <AuthCard title="Start for free" subtitle="Create your landlord account — no credit card required.">
      <Alert>{error}</Alert>
      <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="name" onKeyDown={(e) => e.key === 'Enter' && handleSignup()} />
      <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" onKeyDown={(e) => e.key === 'Enter' && handleSignup()} />
      <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" onKeyDown={(e) => e.key === 'Enter' && handleSignup()} />
      <Field label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" onKeyDown={(e) => e.key === 'Enter' && handleSignup()} />
      <SubmitButton onClick={handleSignup} loading={loading}>
        {loading ? 'Creating account…' : 'Create free account'}
      </SubmitButton>

      <p style={{ textAlign: 'center', fontSize: 14, color: palette.textMuted, margin: '20px 0 0' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: palette.text, fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
      </p>
    </AuthCard>
  )
}

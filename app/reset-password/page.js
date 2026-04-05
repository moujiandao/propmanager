'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleReset = async () => {
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess(true)
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 40, width: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <h2 style={{ color: '#f1f5f9', margin: '0 0 8px' }}>Password updated</h2>
          <p style={{ color: '#94a3b8', marginBottom: 24 }}>You can now log in with your new password.</p>
          <a href="/" style={{ display: 'inline-block', background: '#d97706', color: '#fff', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>Go to login</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <div style={{ background: '#1e293b', borderRadius: 16, padding: 40, width: 360 }}>
        <h2 style={{ color: '#f1f5f9', margin: '0 0 24px', textAlign: 'center' }}>Set new password</h2>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>New Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 15, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f1f5f9', fontSize: 15, boxSizing: 'border-box' }}
          />
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 16px' }}>{error}</p>}
        <button
          onClick={handleReset}
          disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </div>
  )
}

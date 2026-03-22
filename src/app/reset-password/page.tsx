'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#1E1E1E',
    border: '1px solid #2E2E2E',
    color: '#F5F5F5',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => router.replace('/login'), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D0D0D', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.06em' }}>
            <span style={{ color: '#C8102E' }}>LIFT</span>
            <span style={{ color: '#00BFA5' }}>RUN</span>
            <span style={{ color: '#F5F5F5' }}>REPEAT</span>
          </span>
        </div>

        <div style={{ borderRadius: '20px', background: '#141414', border: '1px solid #2E2E2E', overflow: 'hidden' }}>
          <div style={{ padding: '6px 28px 0', borderBottom: '1px solid #2E2E2E' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#00BFA5', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: '14px', margin: 0 }}>
              Reset Password
            </p>
          </div>

          <div style={{ padding: '28px' }}>
            {done ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
                <p style={{ color: '#00BFA5', fontWeight: 700, fontFamily: 'Inter, sans-serif', marginBottom: '8px' }}>Password updated!</p>
                <p style={{ color: '#606060', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Redirecting you to sign in…</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>New Password</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required minLength={6} style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                    onBlur={e => (e.target.style.borderColor = '#2E2E2E')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Confirm Password</label>
                  <input
                    type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••" required minLength={6} style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                    onBlur={e => (e.target.style.borderColor = '#2E2E2E')}
                  />
                </div>

                {error && (
                  <p style={{ color: '#C8102E', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0 }}>{error}</p>
                )}

                <button type="submit" disabled={loading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px',
                    background: loading ? '#1A1A1A' : '#00BFA5',
                    color: loading ? '#606060' : '#0D0D0D',
                    fontWeight: 800, fontSize: '14px', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                  {loading ? 'Updating…' : 'Set New Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

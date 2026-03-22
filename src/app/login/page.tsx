'use client'

import { useState } from 'react'
import { signIn, signUp, resetPassword } from '@/lib/auth'

export default function LoginPage() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)
  const [forgotPassword, setForgotPassword] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await resetPassword(resetEmail)
      setResetDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'signin') {
        await signIn(email, password)
      } else {
        if (!username.trim()) { setError('Username is required'); setLoading(false); return }
        await signUp(username.trim(), email, password)
        setSignupDone(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D0D0D', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.06em' }}>
            <span style={{ color: '#C8102E' }}>LIFT</span>
            <span style={{ color: '#00BFA5' }}>RUN</span>
            <span style={{ color: '#F5F5F5' }}>REPEAT</span>
          </span>
        </div>

        <div style={{ borderRadius: '20px', background: '#141414', border: '1px solid #2E2E2E', overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #2E2E2E' }}>
            {(['signin', 'signup'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); setSignupDone(false); setForgotPassword(false); setResetDone(false) }}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid #00BFA5' : '2px solid transparent',
                  color: tab === t ? '#00BFA5' : '#606060',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '-1px',
                }}>
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <div style={{ padding: '28px' }}>
            {forgotPassword ? (
              resetDone ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
                  <p style={{ color: '#00BFA5', fontWeight: 700, fontFamily: 'Inter, sans-serif', marginBottom: '8px' }}>Check your email</p>
                  <p style={{ color: '#606060', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                    A password reset link has been sent to <strong style={{ color: '#A0A0A0' }}>{resetEmail}</strong>.
                  </p>
                  <button onClick={() => { setForgotPassword(false); setResetDone(false); setResetEmail('') }}
                    style={{ marginTop: '20px', padding: '10px 24px', borderRadius: '10px', background: '#00BFA5', color: '#0D0D0D', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <p style={{ color: '#A0A0A0', fontSize: '13px', fontFamily: 'Inter, sans-serif', marginBottom: '16px', lineHeight: '1.5' }}>
                      Enter your email and we&apos;ll send you a link to reset your password.
                    </p>
                    <label style={{ display: 'block', fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Email</label>
                    <input
                      type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                      placeholder="you@example.com" required style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                      onBlur={e => (e.target.style.borderColor = '#2E2E2E')}
                    />
                  </div>
                  {error && (
                    <p style={{ color: '#C8102E', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0 }}>{error}</p>
                  )}
                  <button type="submit" disabled={loading}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', background: loading ? '#1A1A1A' : '#00BFA5', color: loading ? '#606060' : '#0D0D0D', fontWeight: 800, fontSize: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    {loading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                  <button type="button" onClick={() => { setForgotPassword(false); setError('') }}
                    style={{ background: 'none', border: 'none', color: '#606060', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    Back to Sign In
                  </button>
                </form>
              )
            ) : signupDone ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
                <p style={{ color: '#00BFA5', fontWeight: 700, fontFamily: 'Inter, sans-serif', marginBottom: '8px' }}>Account created!</p>
                <p style={{ color: '#606060', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                  Check your email to confirm your account, then sign in.
                </p>
                <button onClick={() => { setTab('signin'); setSignupDone(false) }}
                  style={{ marginTop: '20px', padding: '10px 24px', borderRadius: '10px', background: '#00BFA5', color: '#0D0D0D', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  Go to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {tab === 'signup' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Username</label>
                    <input
                      type="text" value={username} onChange={e => setUsername(e.target.value)}
                      placeholder="e.g. ben_lifts" required style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                      onBlur={e => (e.target.style.borderColor = '#2E2E2E')}
                    />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Email</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                    onBlur={e => (e.target.style.borderColor = '#2E2E2E')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#606060', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }}>Password</label>
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required minLength={6} style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#00BFA544')}
                    onBlur={e => (e.target.style.borderColor = '#2E2E2E')}
                  />
                </div>

                {tab === 'signin' && (
                  <div style={{ textAlign: 'right', marginTop: '-8px' }}>
                    <button type="button" onClick={() => { setForgotPassword(true); setError(''); setResetEmail(email) }}
                      style={{ background: 'none', border: 'none', color: '#606060', fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#A0A0A0')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#606060')}>
                      Forgot password?
                    </button>
                  </div>
                )}

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
                    fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em',
                    transition: 'all 0.2s',
                  }}>
                  {loading ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

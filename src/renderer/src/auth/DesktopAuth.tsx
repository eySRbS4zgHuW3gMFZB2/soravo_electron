import React, { useState } from 'react'
import HubApp from '../HubApp'
import { useAuth } from './authContext'

export function DesktopAuth() {
  const { session, user, loading, error, signIn, signUp, resetPassword, signOut } = useAuth()
  const [mode, setMode] = useState<'welcome' | 'signin' | 'signup' | 'reset' | 'confirm'>('welcome')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <div className="auth-loading">Loading Soravo…</div>

  if (session && user) return <HubApp />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password)
        setInfo('Check your email for confirmation, then sign in.')
        setMode('confirm')
      } else if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else if (mode === 'reset') {
        await resetPassword(email.trim())
        setInfo('Password reset email sent.')
        setMode('signin')
      }
    } catch (err: any) {
      // error already set by context
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Soravo</h1>
        <p className="auth-sub">Local-first dictation with your own account.</p>
        {mode === 'welcome' && (
          <>
            <p className="auth-copy">Sign in to manage your subscription and device. Your audio stays on this device.</p>
            <div className="auth-actions">
              <button className="auth-primary" onClick={() => setMode('signin')}>Sign in</button>
              <button className="auth-secondary" onClick={() => setMode('signup')}>Create account</button>
            </div>
          </>
        )}
        {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
          <form onSubmit={submit} className="auth-form">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
            {mode !== 'reset' && (
              <div className="auth-password">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
                <button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            )}
            {error && <div className="auth-error">{error}</div>}
            {info && <div className="auth-info">{info}</div>}
            <button className="auth-primary" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
            <div className="auth-links">
              {mode === 'signin' && <><button type="button" onClick={() => setMode('signup')}>Create account</button><button type="button" onClick={() => setMode('reset')}>Forgot password</button></>}
              {mode !== 'signin' && <button type="button" onClick={() => setMode('signin')}>Back to sign in</button>}
              {mode === 'signin' && <button type="button" onClick={signOut}>Sign out</button>}
            </div>
          </form>
        )}
        {mode === 'confirm' && (
          <div className="auth-confirm">
            <p>{info || 'Check your email and then sign in.'}</p>
            <button className="auth-primary" onClick={() => setMode('signin')}>Back to sign in</button>
          </div>
        )}
      </div>
    </div>
  )
}

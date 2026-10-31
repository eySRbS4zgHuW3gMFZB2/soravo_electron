import React, { useCallback, useEffect, useState } from 'react'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import HubApp from '../HubApp'
import { useAuth } from './authContext'
import { supabase } from './supabaseClient'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config'

const env = (import.meta as any).env || {}
const DESKTOP_AUTH_ORIGIN =
  env.VITE_DESKTOP_AUTH_ORIGIN ||
  (import.meta.env.DEV ? 'http://127.0.0.1:5174' : '')
const HOSTED_AUTH_BASE = DESKTOP_AUTH_ORIGIN ? `${DESKTOP_AUTH_ORIGIN}/auth/desktop` : ''
const EXCHANGE_ENDPOINT = `${SUPABASE_URL}/functions/v1/desktop-auth-handoff`
const PENDING_KEY = 'desktop-auth-pending'

function bytesToBase64Url(bytes: Uint8Array) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function randomVerifier(length = 128) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('')
}

async function sha256Base64Url(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return bytesToBase64Url(new Uint8Array(digest))
}

function parseCallbackUrl(url: string) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'soravo:' || u.host !== 'auth' || u.pathname !== '/callback') return null
    const code = u.searchParams.get('code')
    const state = u.searchParams.get('state')
    if (!code || !state) return null
    return { code, state }
  } catch {
    return null
  }
}

async function processCallbackUrls(urls: string[], setInfo: (s: string | null) => void) {
  for (const raw of urls) {
    const parsed = parseCallbackUrl(String(raw))
    if (!parsed) continue
    try {
      const pendingRaw = await window.soravo.secureStoreGet(PENDING_KEY)
      if (!pendingRaw) { setInfo('No authentication request is pending.'); continue }
      const { state: expectedState, verifier } = JSON.parse(pendingRaw)
      if (parsed.state !== expectedState) {
        setInfo('Authentication state mismatch.')
        await window.soravo.secureStoreDelete(PENDING_KEY)
        continue
      }
      let tokenResponse: Response | null = null
      try {
        tokenResponse = await fetch(EXCHANGE_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'exchange', code: parsed.code, code_verifier: verifier, state: parsed.state }),
        })
      } catch {
        tokenResponse = null
      }
      if (!tokenResponse || !tokenResponse.ok) {
        setInfo('Authentication could not be completed.')
        return
      }
      await window.soravo.secureStoreDelete(PENDING_KEY)
      const body = await tokenResponse.json().catch(() => ({}))
      if (body?.session?.access_token && body?.session?.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: body.session.access_token,
          refresh_token: body.session.refresh_token,
        })
        if (error) {
          setInfo('Authentication completed, but the session could not be stored.')
          return
        }
      } else {
        setInfo('Authentication completed, but no session was returned.')
      }
    } catch {
      setInfo('Authentication callback could not be processed safely.')
    }
  }
}

export function DesktopAuth() {
  const { session, loading, signOut } = useAuth()
  const [info, setInfo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const startAuth = useCallback(async (intent: 'signin' | 'signup' | 'reset') => {
    setInfo(null)
    if (!HOSTED_AUTH_BASE) { setInfo('Desktop authentication origin is not configured.'); return }
    setPending(true)
    try {
      const state = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
      const verifier = await randomVerifier()
      const challenge = await sha256Base64Url(verifier)
      await window.soravo.secureStoreSet(PENDING_KEY, JSON.stringify({ state, verifier, createdAt: Date.now() }))
      const url = `${HOSTED_AUTH_BASE}?intent=${intent}&state=${encodeURIComponent(state)}&code_challenge=${challenge}&code_challenge_method=S256&redirect=${encodeURIComponent('soravo://auth/callback')}`
      await window.soravo.openLink(url)
      setInfo('Continue in your system browser. Return to Soravo will be detected automatically.')
    } catch {
      setInfo('Could not open system browser for authentication.')
    } finally {
      setPending(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getCurrent().then((urls) => {
      if (cancelled) return
      if (urls && urls.length) void processCallbackUrls(urls, setInfo)
    }).catch(() => {})
    onOpenUrl((urls) => {
      if (cancelled) return
      if (urls && urls.length) void processCallbackUrls(urls, setInfo)
    }).then((unlisten) => {
      if (cancelled) unlisten()
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="auth-loading">Loading Soravo…</div>
  if (session) return <HubApp onSignOut={signOut} />

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Soravo</h1>
        <p className="auth-sub">Local-first dictation with secure browser sign-in.</p>
        <p className="auth-copy">Credentials are entered in the system browser, not in the desktop app.</p>
        <div className="auth-actions">
          <button className="auth-primary" disabled={pending} onClick={() => void startAuth('signin')}>Sign in</button>
          <button className="auth-secondary" disabled={pending} onClick={() => void startAuth('signup')}>Create account</button>
          <button className="auth-secondary" disabled={pending} onClick={() => void startAuth('reset')}>Reset password</button>
        </div>
        {info && <div className="auth-info">{info}</div>}
      </div>
    </div>
  )
}

import React, { useCallback, useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import HubApp from '../HubApp'
import { useAuth } from './authContext'

const HOSTED_AUTH_BASE = 'https://soravo.xyz/auth/desktop'
const EXCHANGE_ENDPOINT = 'https://soravo.xyz/auth/desktop/exchange'
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
    if (!u.protocol.startsWith('soravo')) return null
    if (!u.pathname.includes('auth/callback')) return null
    const code = u.searchParams.get('code')
    const state = u.searchParams.get('state')
    if (!code || !state) return null
    return { code, state }
  } catch {
    return null
  }
}

export function DesktopAuth() {
  const { session, loading, signOut } = useAuth()
  const [info, setInfo] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const startAuth = useCallback(async (intent: 'signin' | 'signup' | 'reset') => {
    setInfo(null)
    setPending(true)
    try {
      const state = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
      const verifier = await randomVerifier()
      const challenge = await sha256Base64Url(verifier)
      await window.soravo.secureStoreSet(PENDING_KEY, JSON.stringify({ state, verifier, createdAt: Date.now() }))
      const url = `${HOSTED_AUTH_BASE}?intent=${intent}&state=${encodeURIComponent(state)}&code_challenge=${challenge}&code_challenge_method=S256&redirect=${encodeURIComponent('soravo://auth/callback')}`
      await window.soravo.openLink(url)
      setInfo('Continue in your system browser. Return to Soravo will be detected automatically.')
    } catch (e: any) {
      // Note: do not expose secrets or URL query contents.
      setInfo('Could not open system browser for authentication.')
    } finally {
      setPending(false)
    }
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen('tauri://deep-link', async (event) => {
      const urls = Array.isArray(event.payload) ? event.payload : [String(event.payload)]
      for (const raw of urls) {
        const parsed = parseCallbackUrl(String(raw))
        if (!parsed) continue
        try {
          const pendingRaw = await window.soravo.secureStoreGet(PENDING_KEY)
          if (!pendingRaw) { setInfo('No authentication request is pending.'); return }
          const { state: expectedState, verifier } = JSON.parse(pendingRaw)
          if (parsed.state !== expectedState) { setInfo('Authentication state mismatch.'); await window.soravo.secureStoreDelete(PENDING_KEY); return }
          let tokenResponse: Response | null = null
          try {
            tokenResponse = await fetch(EXCHANGE_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: parsed.code, code_verifier: verifier, state: parsed.state }),
            })
          } catch {
            tokenResponse = null
          }
          await window.soravo.secureStoreDelete(PENDING_KEY)
          if (!tokenResponse || !tokenResponse.ok) {
            setInfo('Authentication could not be completed. Missing or unsupported desktop token-exchange endpoint.')
            return
          }
          // A valid exchange returns a JSON body plus session material handled by the website contract.
          const body = await tokenResponse.json().catch(() => ({}))
          if (body?.session && body.session.access_token) {
            await window.soravo.secureStoreSet('desktop-session', JSON.stringify(body.session))
            window.location.reload()
          } else {
            setInfo('Authentication completed, but no session was returned.')
          }
        } catch {
          setInfo('Authentication callback could not be processed safely.')
        }
      }
    }).then((fn) => { unlisten = fn })
    return () => { if (unlisten) unlisten() }
  }, [])

  if (loading) return <div className="auth-loading">Loading Soravo…</div>
  if (session) return <HubApp />

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

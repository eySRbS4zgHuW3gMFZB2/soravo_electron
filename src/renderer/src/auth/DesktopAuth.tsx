import React, { useCallback, useEffect, useRef, useState } from 'react'
import HubApp from '../HubApp'
import { useAuth } from './authContext'
import { supabase } from './supabaseClient'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config'
import {
  createOAuthState,
  createPkceChallenge,
  createPkceVerifier,
  parseDesktopAuthTokenResponse,
  parsePendingDesktopAuth,
  type DesktopAuthCallback,
} from './desktopAuthPrimitives'
import {
  getDesktopAuthDeepLinkWarning,
  subscribeToDesktopAuthCallbacks,
} from './desktopAuthDeepLinks'

const env = (import.meta as any).env || {}
const DESKTOP_AUTH_ORIGIN =
  env.VITE_DESKTOP_AUTH_ORIGIN ||
  (import.meta.env.DEV ? 'http://127.0.0.1:5174' : '')
const HOSTED_AUTH_BASE = DESKTOP_AUTH_ORIGIN ? `${DESKTOP_AUTH_ORIGIN}/auth/desktop` : ''
const EXCHANGE_ENDPOINT = `${SUPABASE_URL}/functions/v1/desktop-auth-handoff`
const PENDING_KEY = 'desktop-auth-pending'
const OTP_TYPE = 'magiclink'

async function clearPendingTransaction() {
  await window.soravo.secureStoreDelete(PENDING_KEY)
}

async function finishAuthentication(tokenHash: unknown, otpType: unknown, setInfo: (s: string | null) => void) {
  if (typeof tokenHash !== 'string' || tokenHash.length < 32 || tokenHash.length > 512 || otpType !== OTP_TYPE) {
    try { await clearPendingTransaction() } catch {
      setInfo('The sign-in response was invalid and its saved request could not be cleared. Start sign-in again.')
      return
    }
    setInfo('The sign-in service returned an invalid response. Start sign-in again.')
    return
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: OTP_TYPE })
    if (error || !data.session) {
      try { await clearPendingTransaction() } catch {
        setInfo('Soravo could not establish the session or clear its saved request. Start sign-in again.')
        return
      }
      setInfo('Soravo could not establish the desktop session. Start sign-in again.')
      return
    }
  } catch {
    try { await clearPendingTransaction() } catch {
      setInfo('Soravo could not save the session or clear its saved request. Check Windows secure storage and restart sign-in.')
      return
    }
    setInfo('Soravo could not save the desktop session in Windows secure storage. Check secure storage and start sign-in again.')
    return
  }

  try { await clearPendingTransaction() } catch {
    setInfo('Signed in. Soravo could not clear the completed sign-in request; the next sign-in will replace it.')
    return
  }
  setInfo('Authentication successful. Your desktop session is stored securely on this device.')
}

async function readTokenResponse(response: Response) {
  try {
    const body: unknown = await response.json()
    const payload = parseDesktopAuthTokenResponse(body)
    if (payload) return payload
  } catch {
    // A consumed handoff cannot be retried after an unreadable success response.
  }
  return { tokenHash: null, otpType: null }
}

async function processCallback(callback: DesktopAuthCallback, setInfo: (s: string | null) => void) {
  let pendingRaw: string | null
  try {
    pendingRaw = await window.soravo.secureStoreGet(PENDING_KEY)
  } catch {
    setInfo('Soravo could not read the sign-in request from Windows secure storage.')
    return
  }

  if (!pendingRaw) {
    setInfo('No sign-in request is waiting in Soravo. Start sign-in again.')
    return
  }

  const pending = parsePendingDesktopAuth(pendingRaw)
  if (!pending) {
    try {
      await clearPendingTransaction()
    } catch {
      setInfo('The saved sign-in request is invalid and could not be cleared. Restart Soravo and try again.')
      return
    }
    setInfo('The saved sign-in request expired or is invalid. Start sign-in again.')
    return
  }

  if (callback.state !== pending.state) {
       setInfo("This response does not match Soravo's sign-in request. Start sign-in again.")
    return
  }

  let response: Response
  try {
    response = await fetch(EXCHANGE_ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        action: 'exchange',
        code: callback.code,
        code_verifier: pending.verifier,
        state: callback.state,
      }),
    })
  } catch {
    setInfo('Soravo could not reach the sign-in service. Check your connection and start sign-in again.')
    return
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 409) {
      try {
        await clearPendingTransaction()
      } catch {
        setInfo('The sign-in response could not be used and its saved request could not be cleared. Start sign-in again.')
        return
      }
      setInfo('The sign-in response expired or was already used. Start sign-in again.')
      return
    }
    setInfo('The sign-in service could not complete the request. Start sign-in again.')
    return
  }

  const { tokenHash, otpType } = await readTokenResponse(response)
  await finishAuthentication(tokenHash, otpType, setInfo)
}

export function DesktopAuth() {
  const { session, loading, error: authError, signOut } = useAuth()
  const [info, setInfo] = useState<string | null>(() => getDesktopAuthDeepLinkWarning())
  const [pending, setPending] = useState(false)
  const callbackQueue = useRef(Promise.resolve())

  const handleCallback = useCallback((callback: DesktopAuthCallback) => {
    callbackQueue.current = callbackQueue.current
      .then(() => processCallback(callback, setInfo))
      .catch(() => setInfo('Authentication could not be completed safely. Start sign-in again.'))
  }, [])

  const startAuth = useCallback(async (intent: 'signin' | 'signup' | 'reset') => {
    setInfo(null)
    if (!HOSTED_AUTH_BASE) {
      setInfo('Desktop authentication is not configured.')
      return
    }

    setPending(true)
    try {
      const state = createOAuthState()
      const verifier = createPkceVerifier()
      const challenge = await createPkceChallenge(verifier)
      await window.soravo.secureStoreSet(PENDING_KEY, JSON.stringify({ state, verifier, createdAt: Date.now() }))
      const url = `${HOSTED_AUTH_BASE}?intent=${intent}&state=${encodeURIComponent(state)}&code_challenge=${challenge}&code_challenge_method=S256&redirect=${encodeURIComponent('soravo://auth/callback')}`
      await window.soravo.openLink(url)
      setInfo('Continue in your browser. After you sign in, choose Continue to Soravo and confirm the browser prompt to finish signing in.')
    } catch {
      setInfo('Soravo could not save or open the sign-in request. Check Windows secure storage and try again.')
    } finally {
      setPending(false)
    }
  }, [])

  useEffect(() => subscribeToDesktopAuthCallbacks(handleCallback), [handleCallback])

   if (loading) return <div className="auth-loading">Loading Soravo...</div>
  if (session) return <HubApp onSignOut={() => { void signOut().catch(() => setInfo('Signed out, but Soravo could not remove the saved session from Windows secure storage. Restart Soravo and sign out again.')) }} />

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Soravo</h1>
        <p className="auth-sub">Local-first dictation with secure browser sign-in.</p>
        <p className="auth-copy">Credentials are entered in the system browser, not in the desktop app.</p>
        {authError && <div className="auth-error" role="alert">{authError}</div>}
        <div className="auth-actions">
          <button className="auth-primary" disabled={pending} onClick={() => void startAuth('signin')}>Sign in</button>
          <button className="auth-secondary" disabled={pending} onClick={() => void startAuth('signup')}>Create account</button>
          <button className="auth-secondary" disabled={pending} onClick={() => void startAuth('reset')}>Reset password</button>
        </div>
        {info && <div className="auth-info" role="status">{info}</div>}
      </div>
    </div>
  )
}
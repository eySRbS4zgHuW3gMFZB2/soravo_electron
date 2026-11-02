export type DesktopAuthCallback = {
  code: string
  state: string
}

export type PendingDesktopAuth = {
  state: string
  verifier: string
  createdAt: number
}

export type DesktopAuthTokenResponse = {
  tokenHash: unknown
  otpType: unknown
}

/**
 * The deployed handoff function predates the `otp_type` response field and
 * only issues magiclink tokens. Preserve compatibility with that response,
 * while rejecting an explicitly different OTP type.
 */
export function parseDesktopAuthTokenResponse(value: unknown): DesktopAuthTokenResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const payload = value as Record<string, unknown>
  return {
    tokenHash: payload.token_hash,
    otpType: payload.otp_type === undefined ? 'magiclink' : payload.otp_type,
  }
}

const verifierCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

export function createPkceVerifier(length = 128): string {
  if (!Number.isInteger(length) || length < 43 || length > 128) {
    throw new RangeError('PKCE verifier length must be between 43 and 128 characters.')
  }

  const limit = Math.floor(256 / verifierCharacters.length) * verifierCharacters.length
  let result = ''
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil((length - result.length) * 1.5)))
    for (const byte of bytes) {
      if (byte >= limit) continue
      result += verifierCharacters[byte % verifierCharacters.length]
      if (result.length === length) break
    }
  }
  return result
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function createOAuthState(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function createPkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return bytesToBase64Url(new Uint8Array(digest))
}

export function parseDesktopAuthCallback(rawUrl: string): DesktopAuthCallback | null {
  try {
    const url = new URL(rawUrl)
    if (
      url.protocol !== 'soravo:' ||
      url.hostname !== 'auth' ||
      url.pathname !== '/callback' ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    ) return null

    const codes = url.searchParams.getAll('code')
    const states = url.searchParams.getAll('state')
    if (codes.length !== 1 || states.length !== 1) return null
    const [code] = codes
    const [state] = states
    if (!code || !/^[A-Za-z0-9]{32}$/.test(code) || !state || state.length !== 43 || !/^[A-Za-z0-9_-]+$/.test(state)) return null
    return { code, state }
  } catch {
    return null
  }
}

export function parsePendingDesktopAuth(value: string, now = Date.now()): PendingDesktopAuth | null {
  try {
    const pending: unknown = JSON.parse(value)
    if (!pending || typeof pending !== 'object') return null
    const record = pending as Record<string, unknown>
    if (typeof record.state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(record.state)) return null
    if (typeof record.verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(record.verifier)) return null
    if (typeof record.createdAt !== 'number' || !Number.isFinite(record.createdAt)) return null
    if (record.createdAt > now + 60_000 || now - record.createdAt > 30 * 60_000) return null
    return { state: record.state, verifier: record.verifier, createdAt: record.createdAt }
  } catch {
    return null
  }
}

export function createCallbackFingerprint(callback: DesktopAuthCallback): Promise<string> {
  const material = new TextEncoder().encode(`${callback.code}\0${callback.state}`)
  return crypto.subtle.digest('SHA-256', material).then((digest) => bytesToBase64Url(new Uint8Array(digest)))
}

export function createInitialSessionGuard() {
  let receivedAuthEvent = false
  return {
    markAuthEvent() {
      receivedAuthEvent = true
    },
    shouldApplyInitialSession() {
      return !receivedAuthEvent
    },
  }
}

export type DesktopAuthCallbackOutcome = 'complete' | 'retryable'
type CallbackEntry = { callback: DesktopAuthCallback; fingerprint: string }
type CallbackHandler = (callback: DesktopAuthCallback) => Promise<DesktopAuthCallbackOutcome>

export class DesktopAuthCallbackBroker {
  private queue: CallbackEntry[] = []
  private seenFingerprints = new Set<string>()
  private handler: CallbackHandler | null = null
  private publishTail = Promise.resolve()
  private failed = false

  publish(urls: string[] | null): Promise<void> {
    this.schedule(() => this.publishSerially(urls))
    return this.publishTail
  }

  hasFailed(): boolean {
    return this.failed
  }

  subscribe(handler: CallbackHandler) {
    this.handler = handler
    this.schedule(async () => {
      while (this.handler && this.queue.length) {
        const entry = this.queue.shift()!
        await this.dispatch(entry, this.handler)
      }
    })
    return () => {
      if (this.handler === handler) this.handler = null
    }
  }

  private schedule(operation: () => Promise<void>) {
    this.publishTail = this.publishTail.then(operation).catch(() => { this.failed = true })
  }

  private async dispatch(entry: CallbackEntry, handler: CallbackHandler) {
    try {
      if (await handler(entry.callback) === 'retryable') this.seenFingerprints.delete(entry.fingerprint)
    } catch {
      // An unexpected failure may occur after exchange; do not permit replay.
      this.failed = true
    }
  }

  private async publishSerially(urls: string[] | null) {
    for (const rawUrl of (urls ?? []).slice(0, 8)) {
      const callback = parseDesktopAuthCallback(rawUrl)
      if (!callback) continue
      const fingerprint = await createCallbackFingerprint(callback)
      if (this.seenFingerprints.has(fingerprint)) continue
      // Retain processed fingerprints; fail closed rather than evicting them.
      if (this.seenFingerprints.size >= 1024) {
        this.failed = true
        return
      }
      this.seenFingerprints.add(fingerprint)
      const entry = { callback, fingerprint }
      if (this.handler) await this.dispatch(entry, this.handler)
      else {
        if (this.queue.length === 8) {
          const evicted = this.queue.shift()!
          this.seenFingerprints.delete(evicted.fingerprint)
        }
        this.queue.push(entry)
      }
    }
  }
}

// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesktopSecureStorage } from '../../../src/renderer/src/auth/secureStorageAdapter'
import {
  DesktopAuthCallbackBroker,
  createInitialSessionGuard,
  createOAuthState,
  createPkceChallenge,
  createPkceVerifier,
  parseDesktopAuthCallback,
  parsePendingDesktopAuth,
} from '../../../src/renderer/src/auth/desktopAuthPrimitives'
import {
  createS256Challenge,
  DESKTOP_OTP_TYPE,
  HANDOFF_CODE_ALPHABET,
  HANDOFF_TTL_MS,
  isValidChallenge,
  isValidHandoffCode,
  isValidState,
  isValidVerifier,
  randomString,
} from '../../supabase/functions/desktop-auth-handoff/contract'
import { createDesktopAuthHandoffHandler, type AuthClient, type HandlerDependencies } from '../../supabase/functions/desktop-auth-handoff/handler'

const state = 'YQ'.repeat(21) + 'Y'
const code = 'a'.repeat(32)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('desktop authentication contracts', () => {
  it('creates PKCE values that match the RFC 7636 S256 test vector', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    await expect(createPkceChallenge(verifier)).resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('uses uniformly sampled RFC 7636 verifier characters and 32-byte state', () => {
    const verifier = createPkceVerifier()
    const oauthState = createOAuthState()
    expect(verifier).toMatch(/^[A-Za-z0-9._~-]{128}$/)
    expect(oauthState).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(() => createPkceVerifier(42)).toThrow(RangeError)
  })

  it('accepts only the Soravo callback endpoint with one code and state', () => {
    expect(parseDesktopAuthCallback(`soravo://auth/callback?code=${code}&state=${state}`)).toEqual({ code, state })
    expect(parseDesktopAuthCallback(`https://auth/callback?code=${code}&state=${state}`)).toBeNull()
    expect(parseDesktopAuthCallback(`soravo://other/callback?code=${code}&state=${state}`)).toBeNull()
    expect(parseDesktopAuthCallback(`soravo://auth/other?code=${code}&state=${state}`)).toBeNull()
    expect(parseDesktopAuthCallback(`soravo://auth/callback?code=${code}&code=${code}&state=${state}`)).toBeNull()
    expect(parseDesktopAuthCallback(`soravo://auth/callback?code=${code}&state=${state}#fragment`)).toBeNull()
  })

  it('rejects malformed, stale, and future pending transactions', () => {
    const now = 1_800_000_000_000
    const pending = JSON.stringify({ state, verifier: createPkceVerifier(), createdAt: now })
    expect(parsePendingDesktopAuth(pending, now)?.state).toBe(state)
    expect(parsePendingDesktopAuth('{broken', now)).toBeNull()
    expect(parsePendingDesktopAuth(JSON.stringify({ state, verifier: 'short', createdAt: now }), now)).toBeNull()
    expect(parsePendingDesktopAuth(JSON.stringify({ state, verifier: createPkceVerifier(), createdAt: now - 31 * 60_000 }), now)).toBeNull()
    expect(parsePendingDesktopAuth(JSON.stringify({ state, verifier: createPkceVerifier(), createdAt: now + 61_000 }), now)).toBeNull()
  })

  it('does not apply stale initial-session results after a newer auth event', () => {
    const guard = createInitialSessionGuard()
    expect(guard.shouldApplyInitialSession()).toBe(true)
    guard.markAuthEvent()
    expect(guard.shouldApplyInitialSession()).toBe(false)
  })

  it('queues startup callbacks until the auth UI subscribes and deduplicates warm delivery', async () => {
    const broker = new DesktopAuthCallbackBroker()
    const url = `soravo://auth/callback?code=${code}&state=${state}`
    await broker.publish([url, url])
    const handler = vi.fn()
    broker.subscribe(handler)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ code, state })
    await broker.publish([url])
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('propagates secure storage read failures instead of treating them as signed out', async () => {
    const readFailure = new Error('secure store unavailable')
    const storage = createDesktopSecureStorage({
      get: vi.fn().mockRejectedValue(readFailure),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    })
    await expect(storage.getItem('supabase.auth.token')).rejects.toBe(readFailure)
  })

  it('enforces bounded S256 handoff inputs and the unchanged two-minute lifetime', () => {
    expect(isValidState(state)).toBe(true)
    expect(isValidChallenge(state)).toBe(true)
    expect(isValidVerifier(createPkceVerifier())).toBe(true)
    expect(isValidHandoffCode(code)).toBe(true)
    expect(isValidState('short')).toBe(false)
    expect(isValidChallenge('x'.repeat(44))).toBe(false)
    expect(isValidVerifier('x'.repeat(129))).toBe(false)
    expect(isValidHandoffCode('x'.repeat(31))).toBe(false)
    expect(HANDOFF_TTL_MS).toBe(120_000)
    expect(DESKTOP_OTP_TYPE).toBe('magiclink')
  })

  it('creates verifiable S256 challenges and handoff codes without out-of-range characters', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    await expect(createS256Challenge(verifier)).resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
    expect(randomString(32, HANDOFF_CODE_ALPHABET)).toMatch(/^[A-Za-z0-9]{32}$/)
    expect(() => randomString(0, HANDOFF_CODE_ALPHABET)).toThrow(RangeError)
  })
})

describe('desktop authentication handoff endpoint', () => {
  async function makeHarness() {
    const row: Record<string, unknown> = {
      id: 'row-1',
      code_hash: '',
      code_challenge: '',
      state,
      token_hash: 'h'.repeat(64),
      expires_at: new Date(Date.now() + 120_000).toISOString(),
      consumed_at: null,
    }
    let consumed = false
    const cleanupExpired = vi.fn(async () => ({ data: null, error: null }))
    const insert = vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(row, values)
      return { data: null, error: null }
    })
    const lookup = vi.fn(async () => ({ data: [{ ...row }], error: null }))
    const consume = vi.fn(async () => {
      if (consumed || new Date(String(row.expires_at)).getTime() <= Date.now()) return { data: [], error: null }
      consumed = true
      return { data: [{ token_hash: row.token_hash }], error: null, status: 200 }
    })
    let deleting = false
    let deletingExpiredForUser = false
    const query = {
      delete: vi.fn(() => { deleting = true; return query }),
      eq: vi.fn((column: string) => { if (deleting && column === 'user_id') deletingExpiredForUser = true; return query }),
      gt: vi.fn(() => query),
      insert: vi.fn((values: Record<string, unknown>) => ({ then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => insert(values).then(resolve, reject) })),
      is: vi.fn(() => query),
      lte: vi.fn(() => query),
      limit: vi.fn(() => ({ then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => lookup().then(resolve, reject) })),
      select: vi.fn(() => query),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
        if (deletingExpiredForUser) {
          deleting = false
          deletingExpiredForUser = false
          return cleanupExpired().then(resolve, reject)
        }
        if (deleting) {
          deleting = false
          return consume().then(resolve, reject)
        }
        return lookup().then(resolve, reject)
      },
    }
    const exchangeQuery = {
      ...query,
      delete: vi.fn(() => { deleting = true; return exchangeQuery }),
      eq: vi.fn(() => exchangeQuery),
      gt: vi.fn(() => exchangeQuery),
      is: vi.fn(() => exchangeQuery),
      select: vi.fn(() => exchangeQuery),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => consume().then(resolve, reject),
    }
    const browserClient = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1', email: 'person@example.com' } }, error: null })) },
      from: vi.fn(() => query),
    }
    const adminClient = {
      auth: { admin: { generateLink: vi.fn(async () => ({ data: { properties: { hashed_token: 'h'.repeat(64), verification_type: 'magiclink' } }, error: null })) } },
      from: vi.fn(() => query),
    }
    const dependencies: HandlerDependencies = {
      readEnvironment: () => ({ supabaseUrl: 'https://example.supabase.co', anonKey: 'anon', serviceKey: 'service' }),
      createClient: vi.fn((_url: string, key: string) => (key === 'service' ? adminClient : browserClient) as unknown as AuthClient),
      now: () => new Date(),
    }
    const handler = createDesktopAuthHandoffHandler(dependencies)
    const exchangeHandler = createDesktopAuthHandoffHandler({
      ...dependencies,
      createClient: vi.fn(() => ({ auth: { getUser: vi.fn() }, from: vi.fn(() => exchangeQuery) }) as unknown as AuthClient),
    })
    const expectedChallenge = await createS256Challenge('a'.repeat(43))
    row.code_challenge = expectedChallenge
    const post = (body: unknown, authorization?: string) => (body && typeof body === 'object' && (body as { action?: string }).action === 'exchange' ? exchangeHandler : handler)(new Request('https://local.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
      body: JSON.stringify(body),
    }))
    return { post, row, query, browserClient, adminClient, consume, lookup, cleanupExpired }
  }

  it('issues an opaque code bound to authenticated user state and an S256 challenge', async () => {
    const harness = await makeHarness()
    const response = await harness.post({ state, code_challenge: state, code_challenge_method: 'S256', action: 'issue' }, 'Bearer browser-token')
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ state })
    expect(payload.code).toMatch(/^[A-Za-z0-9]{32}$/)
    expect(payload.token_hash).toBeUndefined()
    expect(harness.row.code_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(harness.row.token_hash).toBe('h'.repeat(64))
    expect(harness.cleanupExpired).toHaveBeenCalledTimes(1)
    expect(harness.adminClient.auth.admin.generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'person@example.com' })
  })

  it('rejects unauthenticated or malformed issue requests before issuing a handoff', async () => {
    const unauthenticated = await makeHarness()
    expect((await unauthenticated.post({ action: 'issue', state, code_challenge: state, code_challenge_method: 'S256' })).status).toBe(401)
    const malformed = await makeHarness()
    expect((await malformed.post({ action: 'issue', state: 'bad', code_challenge: state, code_challenge_method: 'plain' }, 'Bearer browser-token')).status).toBe(400)
    expect(malformed.adminClient.auth.admin.generateLink).not.toHaveBeenCalled()
  })

  it('exchanges a valid code once and returns the matching OTP verification type', async () => {
    const harness = await makeHarness()
    const response = await harness.post({ action: 'exchange', code, state, code_verifier: 'a'.repeat(43) })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ token_hash: 'h'.repeat(64), state, otp_type: 'magiclink' })
    expect(harness.consume).toHaveBeenCalledTimes(1)
  })

  it('rejects the code-less poll action that could transfer a browser session', async () => {
    const harness = await makeHarness()
    const response = await harness.post({ action: 'poll', state, code_verifier: 'a'.repeat(43) })
    expect(response.status).toBe(400)
    expect(harness.lookup).not.toHaveBeenCalled()
    expect(harness.consume).not.toHaveBeenCalled()
  })

  it('does not consume on state or PKCE mismatch, and returns a conflict on replay', async () => {
    const mismatch = await makeHarness()
    expect((await mismatch.post({ action: 'exchange', code, state: 'Z'.repeat(43), code_verifier: 'a'.repeat(43) })).status).toBe(401)
    expect(mismatch.consume).not.toHaveBeenCalled()
    const pkce = await makeHarness()
    expect((await pkce.post({ action: 'exchange', code, state, code_verifier: 'b'.repeat(43) })).status).toBe(401)
    expect(pkce.consume).not.toHaveBeenCalled()
    const replay = await makeHarness()
    expect((await replay.post({ action: 'exchange', code, state, code_verifier: 'a'.repeat(43) })).status).toBe(200)
    expect((await replay.post({ action: 'exchange', code, state, code_verifier: 'a'.repeat(43) })).status).toBe(409)
  })
})

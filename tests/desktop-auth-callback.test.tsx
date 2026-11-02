import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, expect, it, vi } from 'vitest'
import { DesktopAuthCallbackBroker } from '../src/renderer/src/auth/desktopAuthPrimitives'

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), verifyOtp: vi.fn() }))
vi.mock('../src/renderer/src/HubApp', () => ({ default: () => null }))
vi.mock('../src/renderer/src/auth/authContext', () => ({ useAuth: () => ({ session: null, loading: false, error: null, signOut: vi.fn() }) }))
vi.mock('../src/renderer/src/auth/supabaseClient', () => ({ supabase: { auth: { verifyOtp: mocks.verifyOtp } } }))
vi.mock('../src/renderer/src/auth/desktopAuthDeepLinks', () => ({ getDesktopAuthDeepLinkWarning: () => null, subscribeToDesktopAuthCallbacks: mocks.subscribe }))
import { DesktopAuth } from '../src/renderer/src/auth/DesktopAuth'

afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })

it('does not replay a consumed exchange after local OTP failure', async () => {
  const broker = new DesktopAuthCallbackBroker()
  mocks.subscribe.mockImplementation(handler => broker.subscribe(handler))
  mocks.verifyOtp.mockRejectedValue(new Error('storage failure'))
  const state = 's'.repeat(43)
  const pending = JSON.stringify({ state, verifier: 'a'.repeat(43), createdAt: Date.now() })
  vi.stubGlobal('window', { soravo: { secureStoreGet: vi.fn().mockResolvedValue(pending), secureStoreDelete: vi.fn().mockResolvedValue(undefined) } })
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token_hash: 'h'.repeat(64), otp_type: 'magiclink' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<DesktopAuth />) })
  const callback = `soravo://auth/callback?code=${'a'.repeat(32)}&state=${state}`
  await act(async () => { await broker.publish([callback]); await broker.publish([callback]) })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(mocks.verifyOtp).toHaveBeenCalledTimes(1)
  renderer!.unmount()
})

it('permits redelivery after a transient exchange failure', async () => {
  const broker = new DesktopAuthCallbackBroker()
  mocks.subscribe.mockImplementation(handler => broker.subscribe(handler))
  mocks.verifyOtp.mockResolvedValue({ data: { session: { user: { id: 'user' } } }, error: null })
  const state = 's'.repeat(43)
  const pending = JSON.stringify({ state, verifier: 'a'.repeat(43), createdAt: Date.now() })
  vi.stubGlobal('window', { soravo: { secureStoreGet: vi.fn().mockResolvedValue(pending), secureStoreDelete: vi.fn().mockResolvedValue(undefined) } })
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('network failure')).mockResolvedValueOnce(new Response(JSON.stringify({ token_hash: 'h'.repeat(64), otp_type: 'magiclink' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<DesktopAuth />) })
  const callback = `soravo://auth/callback?code=${'a'.repeat(32)}&state=${state}`
  await act(async () => { await broker.publish([callback]); await broker.publish([callback]); await broker.publish([callback]) })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(mocks.verifyOtp).toHaveBeenCalledTimes(1)
  renderer!.unmount()
})

import React from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token', user: { id: 'user' } } } }),
  onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
}))
const createClient = vi.hoisted(() => vi.fn(() => ({ auth })))
vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('../src/renderer/src/auth/config', async () => {
  const { desktopSessionStorageKey } = await import('../scripts/desktop-supabase-config')
  return { SUPABASE_URL: 'http://[::1]:54321', SUPABASE_PUBLISHABLE_KEY: 'test', DESKTOP_SESSION_STORAGE_KEY: desktopSessionStorageKey('http://[::1]:54321') }
})
const lock = vi.hoisted(() => vi.fn((_name: string, _timeout: number, fn: () => Promise<void>) => fn()))
vi.mock('../src/renderer/src/auth/sessionLock', () => ({ desktopSessionLock: lock }))

import { AuthProvider, useAuth } from '../src/renderer/src/auth/authContext'
import { desktopSessionStorageKey } from '../scripts/desktop-supabase-config'

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

it('uses the same secure key for Supabase and locked sign-out cleanup', async () => {
  const remove = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('window', { soravo: { secureStoreDelete: remove } })
  let current: ReturnType<typeof useAuth>
  function Consumer() { current = useAuth(); return null }
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<AuthProvider><Consumer /></AuthProvider>) })
  await act(async () => { await current!.signOut() })
  const key = desktopSessionStorageKey('http://[::1]:54321')
  expect(createClient).toHaveBeenCalledWith('http://[::1]:54321', 'test', expect.objectContaining({ auth: expect.objectContaining({ storageKey: key }) }))
  expect(lock).toHaveBeenCalledWith(`lock:${key}`, -1, expect.any(Function))
  expect(remove).toHaveBeenCalledWith(key)
  expect(current!.session).toBeNull()
  renderer!.unmount()
})

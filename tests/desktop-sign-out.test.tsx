import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  storageKey: 'sb-vfrhplskegqqdxbykyvx-auth-token',
}))
vi.mock('../src/renderer/src/auth/supabaseClient', () => ({
  supabase: { auth },
  DESKTOP_SESSION_STORAGE_KEY: auth.storageKey,
}))

import { AuthProvider, useAuth } from '../src/renderer/src/auth/authContext'
import { desktopSessionLock } from '../src/renderer/src/auth/sessionLock'

let renderer: ReactTestRenderer | undefined
afterEach(() => {
  renderer?.unmount()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

function installLocks() {
  let tail = Promise.resolve()
  vi.stubGlobal('navigator', { locks: { request: (name: string, _options: unknown, callback: (lock: { name: string }) => Promise<unknown>) => {
    const result = tail.then(() => callback({ name }))
    tail = result.then(() => {}, () => {})
    return result
  } } })
}

async function mount(secureStoreDelete: (key: string) => Promise<void>) {
  vi.stubGlobal('window', { soravo: { secureStoreDelete } })
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 'token', user: { id: 'user' } } } })
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  let current: ReturnType<typeof useAuth>
  function Consumer() { current = useAuth(); return null }
  await act(async () => { renderer = create(<AuthProvider><Consumer /></AuthProvider>) })
  return () => current!
}

it('waits for an in-flight session operation before deleting the stored session', async () => {
  installLocks()
  const secureStoreDelete = vi.fn(async (_key: string) => {})
  auth.signOut.mockResolvedValue({ error: null })
  const current = await mount(secureStoreDelete)
  let release!: () => void
  const held = desktopSessionLock(`lock:${auth.storageKey}`, -1, () => new Promise<void>((resolve) => { release = resolve }))
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  let signingOut!: Promise<void>
  await act(async () => { signingOut = current().signOut(); await Promise.resolve() })
  expect(secureStoreDelete).not.toHaveBeenCalled()
  await act(async () => { release(); await held; await signingOut })
  expect(secureStoreDelete).toHaveBeenCalledWith(auth.storageKey)
  expect(current().session).toBeNull()
})

it('clears the UI after secure deletion and reports the Supabase error', async () => {
  installLocks()
  const failure = new Error('sign-out failed')
  auth.signOut.mockResolvedValue({ error: failure })
  const remove = vi.fn(async () => {})
  const current = await mount(remove)
  await act(async () => {
    await expect(current().signOut()).rejects.toMatchObject({ name: 'DesktopRemoteSignOutError', cause: failure })
  })
  expect(remove).toHaveBeenCalledWith(auth.storageKey)
  expect(current().session).toBeNull()
})

it('does not delete or clear the UI when cross-context locking is unavailable', async () => {
  vi.stubGlobal('navigator', {})
  const remove = vi.fn(async () => {})
  auth.signOut.mockResolvedValue({ error: null })
  const current = await mount(remove)
  await act(async () => { await expect(current().signOut()).rejects.toThrow('Web Locks') })
  expect(remove).not.toHaveBeenCalled()
  expect(current().user?.id).toBe('user')
})

it('reports both failures and retains the session if cleanup also fails', async () => {
  installLocks()
  const signOutFailure = new Error('sign-out failed')
  const storageFailure = new Error('storage failed')
  auth.signOut.mockResolvedValue({ error: signOutFailure })
  const current = await mount(vi.fn(async () => { throw storageFailure }))
  await act(async () => {
    try { await current().signOut(); throw new Error('expected failure') } catch (error) {
      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).errors).toEqual([signOutFailure, storageFailure])
    }
  })
  expect(current().user?.id).toBe('user')
})

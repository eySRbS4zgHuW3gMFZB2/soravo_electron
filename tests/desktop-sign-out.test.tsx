import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('../src/renderer/src/auth/supabaseClient', () => ({ supabase: { auth } }))

import { AuthProvider, useAuth } from '../src/renderer/src/auth/authContext'

let renderer: ReactTestRenderer | undefined
afterEach(() => {
  renderer?.unmount()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

it('removes the stored desktop session on sign-out', async () => {
  const stored = new Map([['desktop-session', 'saved session']])
  const secureStoreDelete = vi.fn(async (key: string) => { stored.delete(key) })
  vi.stubGlobal('window', { soravo: { secureStoreDelete } })
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 'token', user: { id: 'user' } } } })
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  auth.signOut.mockResolvedValue({ error: null })
  let current: ReturnType<typeof useAuth> | undefined
  function Consumer() {
    current = useAuth()
    return null
  }

  await act(async () => { renderer = create(<AuthProvider><Consumer /></AuthProvider>) })
  expect(current?.user?.id).toBe('user')
  await act(async () => { await current!.signOut() })

  expect(auth.signOut).toHaveBeenCalledOnce()
  expect(secureStoreDelete).toHaveBeenCalledWith('desktop-session')
  expect(stored.has('desktop-session')).toBe(false)
  expect(current?.session).toBeNull()
})

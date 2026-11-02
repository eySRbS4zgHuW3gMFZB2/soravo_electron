import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ session: null as null | { user: { id: string } }, signOut: vi.fn() }))
vi.mock('../src/renderer/src/HubApp', () => ({ default: ({ onSignOut }: { onSignOut: () => void }) => <button onClick={onSignOut}>Sign out</button> }))
vi.mock('../src/renderer/src/auth/authContext', () => ({ useAuth: () => ({ session: auth.session, loading: false, error: null, signOut: auth.signOut }) }))
vi.mock('../src/renderer/src/auth/supabaseClient', () => ({ supabase: {} }))
vi.mock('../src/renderer/src/auth/desktopAuthDeepLinks', () => ({ getDesktopAuthDeepLinkWarning: () => null, subscribeToDesktopAuthCallbacks: () => () => {} }))
import { DesktopAuth } from '../src/renderer/src/auth/DesktopAuth'

let renderer: ReactTestRenderer | undefined
afterEach(() => { renderer?.unmount(); vi.unstubAllGlobals(); auth.session = null; vi.resetAllMocks() })

it('disables desktop sign-in and explains unsupported secure storage', async () => {
  const secureStoreGet = vi.fn().mockRejectedValue('unsupported')
  const openLink = vi.fn()
  vi.stubGlobal('window', { soravo: { secureStoreGet, openLink } })
  await act(async () => { renderer = create(<DesktopAuth />) })
  expect(renderer!.root.findAllByType('button').every((button) => button.props.disabled)).toBe(true)
  expect(renderer!.root.findByProps({ role: 'alert' }).children.join('')).toContain('requires Windows')
  expect(openLink).not.toHaveBeenCalled()
})

it('shows an error when sign-out fails and the session remains active', async () => {
  auth.session = { user: { id: 'user' } }
  auth.signOut.mockRejectedValue(new Error('failed'))
  vi.stubGlobal('window', { soravo: { secureStoreGet: vi.fn().mockResolvedValue(null) } })
  await act(async () => { renderer = create(<DesktopAuth />) })
  await act(async () => { renderer!.root.findByType('button').props.onClick() })
  expect(renderer!.root.findByProps({ role: 'alert' }).children.join('')).toContain('Sign-out could not be completed')
})

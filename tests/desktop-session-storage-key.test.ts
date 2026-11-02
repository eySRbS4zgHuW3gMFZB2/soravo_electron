import { afterEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })))
vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('../src/renderer/src/auth/storage', () => ({ desktopSecureStorage: {} }))
vi.mock('../src/renderer/src/auth/sessionLock', () => ({ desktopSessionLock: vi.fn() }))

afterEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.doUnmock('../src/renderer/src/auth/config') })

describe('desktop session storage key', () => {
  it.each([
    ['http://[::1]:54321', 'supabase-ipv6-loopback-auth-token'],
    ['http://[0:0:0:0:0:0:0:1]:54321', 'supabase-ipv6-loopback-auth-token'],
    ['https://vfrhplskegqqdxbykyvx.supabase.co', 'sb-vfrhplskegqqdxbykyvx-auth-token'],
    ['http://127.0.0.1:54321', 'sb-127-auth-token'],
    ['http://localhost:54321', 'sb-localhost-auth-token'],
  ])('uses the compatible key for %s', async (url, expected) => {
    vi.resetModules()
    vi.doMock('../src/renderer/src/auth/config', () => ({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: 'test' }))
    const { DESKTOP_SESSION_STORAGE_KEY } = await import('../src/renderer/src/auth/supabaseClient')
    expect(DESKTOP_SESSION_STORAGE_KEY).toBe(expected)
    expect(DESKTOP_SESSION_STORAGE_KEY).toMatch(/^[a-z0-9_-]{1,251}$/)
    expect(createClient).toHaveBeenCalledWith(url, 'test', expect.objectContaining({ auth: expect.objectContaining({ storageKey: expected }) }))
  })
})

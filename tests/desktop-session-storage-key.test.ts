import { afterEach, describe, expect, it, vi } from 'vitest'
import { desktopSessionStorageKey } from '../scripts/desktop-supabase-config'
import { validateSupabaseUrl } from '../src/renderer/src/auth/supabaseUrl'

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })))
vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('../src/renderer/src/auth/storage', () => ({ desktopSecureStorage: {} }))
vi.mock('../src/renderer/src/auth/sessionLock', () => ({ desktopSessionLock: vi.fn() }))
afterEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.doUnmock('../src/renderer/src/auth/config') })

describe('desktop session storage key', () => {
  it('preserves only canonical Supabase project keys', () => {
    expect(desktopSessionStorageKey(validateSupabaseUrl('https://vfrhplskegqqdxbykyvx.supabase.co/'))).toBe('sb-vfrhplskegqqdxbykyvx-auth-token')
    for (const url of ['https://vfrhplskegqqdxbykyvx.supabase.co:8443', 'https://vfrhplskegqqdxbykyvx.supabase.co/path', 'http://localhost:54321', 'http://127.0.0.1:54321', 'http://[::1]:54321', 'https://custom.example']) {
      expect(desktopSessionStorageKey(validateSupabaseUrl(url))).toMatch(/^soravo-url-[a-f0-9]{64}$/)
    }
  })

  it('separates full URLs, including ports and paths, while normalizing IPv6', () => {
    const key = (url: string) => desktopSessionStorageKey(validateSupabaseUrl(url))
    expect(key('http://localhost:54321')).not.toBe(key('http://localhost:54322'))
    expect(key('http://[::1]:54321')).not.toBe(key('http://[::1]:54322'))
    expect(key('http://[::1]:54321')).toBe(key('http://[0:0:0:0:0:0:0:1]:54321'))
    expect(key('https://custom.example/a')).not.toBe(key('https://custom.example/b'))
    expect(key('https://project.one.example')).not.toBe(key('https://project.two.example'))
  })

  it('uses the resolved key for the Supabase client', async () => {
    const url = validateSupabaseUrl('http://[::1]:54321')
    const expected = desktopSessionStorageKey(url)
    vi.doMock('../src/renderer/src/auth/config', () => ({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: 'test', DESKTOP_SESSION_STORAGE_KEY: expected }))
    const { DESKTOP_SESSION_STORAGE_KEY } = await import('../src/renderer/src/auth/supabaseClient')
    expect(DESKTOP_SESSION_STORAGE_KEY).toBe(expected)
    expect(createClient).toHaveBeenCalledWith(url, 'test', expect.objectContaining({ auth: expect.objectContaining({ storageKey: expected }) }))
  })
})

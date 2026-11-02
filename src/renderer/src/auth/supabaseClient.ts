import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config'
import { desktopSecureStorage } from './storage'
import { desktopSessionLock } from './sessionLock'

// Keep existing project keys for persisted sessions. The IPv6 loopback default
// contains characters rejected by the secure store, so it gets a distinct key.
const hostname = new URL(SUPABASE_URL).hostname
export const DESKTOP_SESSION_STORAGE_KEY = hostname === '[::1]'
  ? 'supabase-ipv6-loopback-auth-token'
  : `sb-${hostname.split('.')[0]}-auth-token`

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: DESKTOP_SESSION_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: desktopSecureStorage,
    lock: desktopSessionLock,
  },
})

export type SupabaseSession = typeof supabase extends { auth: { getSession: (...args: any) => Promise<{ data: { session: infer S } }> } } ? S : any

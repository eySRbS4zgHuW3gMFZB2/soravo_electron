import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config'
import { desktopSecureStorage } from './storage'
import { desktopSessionLock } from './sessionLock'

// Pin Supabase JS's existing default key so sign-out fallback cleanup targets
// the same record without changing where already-persisted sessions live.
export const DESKTOP_SESSION_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

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

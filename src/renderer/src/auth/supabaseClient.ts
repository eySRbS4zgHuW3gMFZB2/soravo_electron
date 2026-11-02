import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, DESKTOP_SESSION_STORAGE_KEY } from './config'
import { desktopSecureStorage } from './storage'
import { desktopSessionLock } from './sessionLock'

// The key is derived from the same validated URL as the renderer and CSP.
export { DESKTOP_SESSION_STORAGE_KEY }

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

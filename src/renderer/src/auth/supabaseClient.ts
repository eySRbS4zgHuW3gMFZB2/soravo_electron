import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config'
import { desktopSecureStorage } from './storage'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: desktopSecureStorage,
  },
})

export type SupabaseSession = typeof supabase extends { auth: { getSession: (...args: any) => Promise<{ data: { session: infer S } }> } } ? S : any

declare const __DESKTOP_SUPABASE_URL__: string

// Public, non-secret SORAVO Supabase client configuration.
// The service role key must never be used in the desktop application.
const env = (import.meta as any).env || {}

export const SUPABASE_URL = __DESKTOP_SUPABASE_URL__
export const SUPABASE_PUBLISHABLE_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_Hq_D1BrsZmuj8GVrQcmj0Q_1LwaLEY2'

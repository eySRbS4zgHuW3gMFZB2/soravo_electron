// Public, non-secret SORAVO Supabase client configuration.
// The service role key must never be used in the desktop application.
const env = (import.meta as any).env || {}

export const SUPABASE_URL =
  env.VITE_SUPABASE_URL || 'https://vfrhplskegqqdxbykyvx.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_Hq_D1BrsZmuj8GVrQcmj0Q_1LwaLEY2'

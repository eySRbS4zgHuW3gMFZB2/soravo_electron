declare const __DESKTOP_SUPABASE_URL__: string
declare const __DESKTOP_SUPABASE_KEY__: string
declare const __DESKTOP_SESSION_STORAGE_KEY__: string

// Public configuration resolved with the same website values by Vite.
// Service role keys must never be used in the desktop application.
export const SUPABASE_URL = __DESKTOP_SUPABASE_URL__
export const SUPABASE_PUBLISHABLE_KEY = __DESKTOP_SUPABASE_KEY__
export const DESKTOP_SESSION_STORAGE_KEY = __DESKTOP_SESSION_STORAGE_KEY__

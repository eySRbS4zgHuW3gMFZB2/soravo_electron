import { navigatorLock } from '@supabase/supabase-js'

// Every webview must use the same cross-context lock for auth and cleanup.
// Fail closed when Web Locks are unavailable rather than deleting during refresh.
export async function desktopSessionLock<R>(name: string, timeout: number, fn: () => Promise<R>): Promise<R> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) {
    throw new Error('Desktop authentication requires Web Locks.')
  }
  return navigatorLock(name, timeout, fn)
}

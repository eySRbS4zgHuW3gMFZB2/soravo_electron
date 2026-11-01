// Secure, DPAPI-backed storage for Supabase sessions on Windows.
// Supabase supports asynchronous Storage implementations.
import { createDesktopSecureStorage } from './secureStorageAdapter'

export const desktopSecureStorage = createDesktopSecureStorage({
  get: (key) => window.soravo.secureStoreGet(key),
  set: (key, value) => window.soravo.secureStoreSet(key, value),
  remove: (key) => window.soravo.secureStoreDelete(key),
})

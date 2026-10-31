// Secure, DPAPI-backed storage for Supabase sessions on Windows.
// Supabase supports asynchronous Storage implementations.
export const desktopSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await window.soravo.secureStoreGet(key)
    } catch {
      return null
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    await window.soravo.secureStoreSet(key, value)
  },
  async removeItem(key: string): Promise<void> {
    await window.soravo.secureStoreDelete(key)
  },
}

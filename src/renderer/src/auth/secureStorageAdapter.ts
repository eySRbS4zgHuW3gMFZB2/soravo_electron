export interface SecureStorageBridge {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export function createDesktopSecureStorage(bridge: SecureStorageBridge) {
  return {
    getItem: (key: string) => bridge.get(key),
    setItem: (key: string, value: string) => bridge.set(key, value),
    removeItem: (key: string) => bridge.remove(key),
  }
}

import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { DesktopAuthCallbackBroker, type DesktopAuthCallback } from './desktopAuthPrimitives'

type CallbackHandler = (callback: DesktopAuthCallback) => void

const broker = new DesktopAuthCallbackBroker()
let initializePromise: Promise<void> | null = null
let initializationWarning = false

export function initializeDesktopAuthDeepLinks(): Promise<void> {
  if (initializePromise) return initializePromise

  initializePromise = (async () => {
    // Install the warm-start listener before reading the startup URL. The
    // broker deduplicates a callback that both paths observe.
    try {
      await onOpenUrl((urls) => {
        void broker.publish(urls)
      })
    } catch {
      initializationWarning = true
    }
    try {
      const startupUrls = await getCurrent()
      await broker.publish(startupUrls)
    } catch {
      initializationWarning = true
    }
  })()

  return initializePromise
}

export function getDesktopAuthDeepLinkWarning(): string | null {
  return initializationWarning || broker.hasFailed()
    ? 'Soravo could not initialize all callback listeners. Restart the app before starting sign-in.'
    : null
}

export function subscribeToDesktopAuthCallbacks(handler: CallbackHandler) {
  return broker.subscribe(handler)
}

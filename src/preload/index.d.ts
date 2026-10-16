import type { RecState, SoravoAPI, SoravoSettings, TranscriptEntry } from './index'

declare global {
  interface Window {
    soravo: SoravoAPI
  }
}

export type { RecState, SoravoAPI, SoravoSettings, TranscriptEntry }

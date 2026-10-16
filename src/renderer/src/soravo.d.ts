export type RecState = 'idle' | 'recording' | 'transcribing' | 'error'

export interface TranscriptEntry {
  id: number
  text: string
  createdAt: string
  durationMs: number | null
}

export interface SoravoSettings {
  hotkey: string
  pasteHotkey: string
  copyHotkey: string
  model: string
  language: string
  microphoneId: string
  sounds: boolean
  smartCleanup: boolean
  vocabulary: Record<string, string>
  launchAtLogin: boolean
  theme: 'light' | 'dark'
  retention: 'all' | '30days' | 'session'
}

export interface SoravoAPI {
  toggle(): Promise<void>
  quit(): Promise<void>
  getState(): Promise<RecState>
  onState(cb: (s: RecState) => void): () => void
  onRecordCommand(cb: (cmd: 'start' | 'stop' | 'cancel') => void): () => void
  submitAudio(wav: ArrayBuffer, durationMs: number): Promise<void>
  cancel(): Promise<void>
  setHeight(px: number): Promise<void>
  onTranscript(cb: (text: string) => void): () => void
  onError(cb: (message: string) => void): () => void
  getHistory(limit?: number): Promise<TranscriptEntry[]>
  clearHistory(): Promise<void>
  getSettings(): Promise<SoravoSettings>
  setSettings(patch: Partial<SoravoSettings>): Promise<SoravoSettings>
}

declare global {
  interface Window {
    soravo: SoravoAPI
  }
}

export {}

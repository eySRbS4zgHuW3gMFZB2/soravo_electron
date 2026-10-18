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

export interface InsightsData {
  dictations: number
  words: number
  audioMinutes: number
  avgWpm: number
  topWpm: number
  dayStreak: number
  longestStreak: number
  correctionsFillers: number
  correctionsVocab: number
  perDay: Array<{ date: string; words: number }>
  perHour: number[]
  perWeekday: number[]
  topWords: Array<{ word: string; count: number }>
  topPhrases: Array<{ phrase: string; count: number }>
}

export interface ModelInfo {
  id: string
  name: string
  sizeBytes: number
  sizeLabel: string
  license: string
  installed: boolean
  active: boolean
  url: string
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
  onDataChanged(cb: () => void): () => void
  getHistory(limit?: number): Promise<TranscriptEntry[]>
  clearHistory(): Promise<void>
  getInsights(): Promise<InsightsData>
  getSettings(): Promise<SoravoSettings>
  setSettings(patch: Partial<SoravoSettings>): Promise<SoravoSettings>
  listModels(): Promise<ModelInfo[]>
  downloadModel(id: string): Promise<void>
  deleteModel(id: string): Promise<void>
  setActiveModel(id: string): Promise<void>
  onModelDownloadProgress(cb: (p: { id: string; received: number; total: number; percent: number }) => void): () => void
  onModelDownloadComplete(cb: (p: { id: string }) => void): () => void
}

declare global {
  interface Window {
    soravo: SoravoAPI
  }
}

export {}

import { contextBridge, ipcRenderer } from 'electron'

export type RecState = 'idle' | 'recording' | 'transcribing' | 'error'

export interface TranscriptEntry {
  id: number
  text: string
  createdAt: string
  durationMs: number | null
}

export type Retention = 'all' | '30days' | 'session'
export type Theme = 'light' | 'dark'

export interface SoravoSettings {
  /** Electron accelerator for push-to-talk, e.g. CommandOrControl+Alt+Space */
  hotkey: string
  /** Re-inject the last transcript into the focused app */
  pasteHotkey: string
  /** Copy the last transcript to the clipboard */
  copyHotkey: string
  /** whisper.cpp model id, e.g. base.en (file ggml-base.en.bin) */
  model: string
  /** whisper language code, e.g. en */
  language: string
  /** Microphone deviceId, '' = auto-detect */
  microphoneId: string
  /** UI feedback blips */
  sounds: boolean
  /** Local post-processing: fillers, spacing, capitalization */
  smartCleanup: boolean
  /** Custom vocabulary: spoken form -> written form */
  vocabulary: Record<string, string>
  /** Launch Soravo at OS login */
  launchAtLogin: boolean
  /** UI theme */
  theme: Theme
  /** History retention */
  retention: Retention
}

export interface InsightsData {
  dictations: number
  words: number
  audioMinutes: number
  avgWpm: number
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
  getInsights(): Promise<InsightsData>
  onHistoryDelete(id: number): Promise<void>
  getRuntimeStatus(): Promise<{ binary: boolean; model: string; modelPresent: boolean }>
  winMin(): Promise<void>
  winMax(): Promise<void>
  winClose(): Promise<void>
  getSettings(): Promise<SoravoSettings>
  setSettings(patch: Partial<SoravoSettings>): Promise<SoravoSettings>
}

const api: SoravoAPI = {
  toggle: () => ipcRenderer.invoke('soravo:toggle'),
  quit: () => ipcRenderer.invoke('soravo:quit'),
  getState: () => ipcRenderer.invoke('soravo:get-state'),
  onRecordCommand: (cb) => {
    const fn = (_e: unknown, cmd: 'start' | 'stop' | 'cancel') => cb(cmd)
    ipcRenderer.on('soravo:record-command', fn)
    return () => ipcRenderer.removeListener('soravo:record-command', fn)
  },
  submitAudio: (wav, durationMs) =>
    ipcRenderer.invoke('soravo:submit-audio', wav, durationMs),
  cancel: () => ipcRenderer.invoke('soravo:cancel'),
  setHeight: (px) => ipcRenderer.invoke('soravo:set-height', px),
  onState: (cb) => {
    const fn = (_e: unknown, s: RecState) => cb(s)
    ipcRenderer.on('soravo:state', fn)
    return () => ipcRenderer.removeListener('soravo:state', fn)
  },
  onTranscript: (cb) => {
    const fn = (_e: unknown, text: string) => cb(text)
    ipcRenderer.on('soravo:transcript', fn)
    return () => ipcRenderer.removeListener('soravo:transcript', fn)
  },
  onError: (cb) => {
    const fn = (_e: unknown, message: string) => cb(message)
    ipcRenderer.on('soravo:error', fn)
    return () => ipcRenderer.removeListener('soravo:error', fn)
  },
  getHistory: (limit = 50) => ipcRenderer.invoke('soravo:history', limit),
  clearHistory: () => ipcRenderer.invoke('soravo:history-clear'),
  getInsights: () => ipcRenderer.invoke('soravo:insights'),
  onHistoryDelete: (id) => ipcRenderer.invoke('soravo:history-delete', id),
  getRuntimeStatus: () => ipcRenderer.invoke('soravo:runtime-status'),
  winMin: () => ipcRenderer.invoke('soravo:win-min'),
  winMax: () => ipcRenderer.invoke('soravo:win-max'),
  winClose: () => ipcRenderer.invoke('soravo:win-close'),
  getSettings: () => ipcRenderer.invoke('soravo:settings-get'),
  setSettings: (patch) => ipcRenderer.invoke('soravo:settings-set', patch)
}

contextBridge.exposeInMainWorld('soravo', api)

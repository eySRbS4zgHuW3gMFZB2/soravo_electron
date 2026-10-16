import { contextBridge, ipcRenderer } from 'electron'

export type RecState = 'idle' | 'recording' | 'transcribing' | 'error'

export interface TranscriptEntry {
  id: number
  text: string
  createdAt: string
  durationMs: number | null
}

export interface SoravoSettings {
  hotkey: string
  model: string
  language: string
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
  onHistoryDelete: (id) => ipcRenderer.invoke('soravo:history-delete', id),
  getRuntimeStatus: () => ipcRenderer.invoke('soravo:runtime-status'),
  winMin: () => ipcRenderer.invoke('soravo:win-min'),
  winMax: () => ipcRenderer.invoke('soravo:win-max'),
  winClose: () => ipcRenderer.invoke('soravo:win-close'),
  getSettings: () => ipcRenderer.invoke('soravo:settings-get'),
  setSettings: (patch) => ipcRenderer.invoke('soravo:settings-set', patch)
}

contextBridge.exposeInMainWorld('soravo', api)

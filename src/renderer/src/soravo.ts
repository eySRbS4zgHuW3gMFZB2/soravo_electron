import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export type RecState = 'idle' | 'recording' | 'transcribing' | 'error'

export interface ScratchpadNote {
  id: number
  text: string
  createdAt: string
  pinned: boolean
}

export interface Snippet {
  id: number
  phrase: string
  expansion: string
  createdAt: string
  updatedAt: string
  isAutoLearned: boolean
}

export interface TranscriptEntry {
  id: number
  text: string
  createdAt: string
  durationMs: number | null
}

export type Retention = 'all' | '30days' | 'session'
export type Theme = 'light' | 'dark'

export interface SoravoSettings {
  hotkey: string
  pasteHotkey: string
  copyHotkey: string
  holdToTalk: boolean
  model: string
  language: string
  microphoneId: string
  sounds: boolean
  smartCleanup: boolean
  addPunctuation: boolean
  vocabulary: Record<string, string>
  launchAtLogin: boolean
  theme: Theme
  retention: Retention
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
  language: string
  microphoneId: string
  sounds: boolean
  smartCleanup: boolean
  addPunctuation: boolean
  vocabulary: Record<string, string>
  launchAtLogin: boolean
  theme: Theme
  retention: Retention
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
  perMonth: number[]
  perYear: Array<{ year: number; words: number }>
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
  onDataChanged(cb: () => void): () => void
  getHistory(limit?: number): Promise<TranscriptEntry[]>
  clearHistory(): Promise<void>
  getInsights(): Promise<InsightsData>
  onHistoryDelete(id: number): Promise<void>
  getRuntimeStatus(): Promise<{ binary: boolean; model: string; modelPresent: boolean }>
  listModels(): Promise<ModelInfo[]>
  downloadModel(id: string): Promise<void>
  deleteModel(id: string): Promise<void>
  setActiveModel(id: string): Promise<void>
  onModelDownloadProgress(cb: (p: { id: string; received: number; total: number; percent: number }) => void): () => void
  onModelDownloadComplete(cb: (p: { id: string }) => void): () => void
  winMin(): Promise<void>
  winMax(): Promise<void>
  winClose(): Promise<void>
  getScratchpadNotes(): Promise<ScratchpadNote[]>
  addScratchpadNote(text: string): Promise<ScratchpadNote>
  deleteScratchpadNote(id: number): Promise<void>
  updateScratchpadNote(id: number, patch: { text?: string; pinned?: boolean }): Promise<void>
  onScratchpadChanged(cb: () => void): () => void
  openScratchpadWindow(): Promise<void>
  getSettings(): Promise<SoravoSettings>
  setSettings(patch: Partial<SoravoSettings>): Promise<SoravoSettings>
  validateBinding(accel: string): Promise<boolean>
  bindingHelp(): Promise<Record<string, string[]>>
}

// Map camelCase settings to the Tauri command format
function settingsToTauri(s: SoravoSettings): Record<string, unknown> {
  return {
    hotkey: s.hotkey,
    pasteHotkey: s.pasteHotkey,
    copyHotkey: s.copyHotkey,
    model: s.model,
    language: s.language,
    microphoneId: s.microphoneId,
    sounds: s.sounds,
    smartCleanup: s.smartCleanup,
    addPunctuation: s.addPunctuation,
    vocabulary: s.vocabulary,
    launchAtLogin: s.launchAtLogin,
    theme: s.theme,
    retention: s.retention,
  }
}

function settingsFromTauri(s: any): SoravoSettings {
  return {
    hotkey: s.hotkey ?? s.hotKey ?? 'CommandOrControl+Alt+Space',
    pasteHotkey: s.pasteHotkey ?? s.paste_hotkey ?? 'CommandOrControl+Alt+V',
    copyHotkey: s.copyHotkey ?? s.copy_hotkey ?? 'CommandOrControl+Alt+C',
    holdToTalk: s.holdToTalk ?? s.hold_to_talk ?? false,
    model: s.model ?? 'base.en',
    language: s.language ?? 'en',
    microphoneId: s.microphoneId ?? s.microphone_id ?? '',
    sounds: s.sounds ?? true,
    smartCleanup: s.smartCleanup ?? s.smart_cleanup ?? true,
    addPunctuation: s.addPunctuation ?? s.add_punctuation ?? true,
    vocabulary: s.vocabulary ?? {},
    launchAtLogin: s.launchAtLogin ?? s.launch_at_login ?? true,
    theme: s.theme ?? 'light',
    retention: s.retention ?? 'all',
  }
}

// Event listeners
const listeners: Record<string, Set<Function>> = {}

async function setupEventListeners() {
  await listen('soravo:state', (event) => {
    const cbs = listeners['state']
    if (cbs) cbs.forEach((cb) => cb(event.payload))
  })
  await listen('soravo:record-command', (event) => {
    const cbs = listeners['record-command']
    if (cbs) cbs.forEach((cb) => cb(event.payload))
  })
  await listen('soravo:transcript', (event) => {
    const cbs = listeners['transcript']
    if (cbs) cbs.forEach((cb) => cb(event.payload))
  })
  await listen('soravo:error', (event) => {
    const cbs = listeners['error']
    if (cbs) cbs.forEach((cb) => cb(event.payload))
  })
  await listen('soravo:data-changed', () => {
    const cbs = listeners['data-changed']
    if (cbs) cbs.forEach((cb) => cb())
  })
  await listen('soravo:model-download-progress', (event) => {
    const cbs = listeners['model-download-progress']
    if (cbs) cbs.forEach((cb) => cb(event.payload))
  })
  await listen('soravo:model-download-complete', (event) => {
    const cbs = listeners['model-download-complete']
    if (cbs) cbs.forEach((cb) => cb(event.payload))
  })
  await listen('soravo:scratchpad-changed', () => {
    const cbs = listeners['scratchpad-changed']
    if (cbs) cbs.forEach((cb) => cb())
  })
  // Listen for hotkey toggle events from the Rust backend
  await listen('soravo:toggle-hotkey', () => {
    soravo.toggle().catch(console.error)
  })
}

setupEventListeners().catch(console.error)

function addListener(key: string, cb: Function): () => void {
  if (!listeners[key]) listeners[key] = new Set()
  listeners[key].add(cb)
  return () => listeners[key]?.delete(cb)
}

export const soravo: SoravoAPI = {
  toggle: () => invoke('toggle'),
  quit: () => invoke('quit'),
  getState: () => invoke<RecState>('get_state'),
  onState: (cb) => addListener('state', cb as Function),
  onRecordCommand: (cb) => addListener('record-command', cb as Function),
  submitAudio: async (wav, durationMs) => {
    const arr = new Uint8Array(wav)
    await invoke('submit_audio', { wav: Array.from(arr), durationMs })
  },
  cancel: () => invoke('cancel'),
  setHeight: (px) => invoke('set_height', { px }),
  onTranscript: (cb) => addListener('transcript', cb as Function),
  onError: (cb) => addListener('error', cb as Function),
  onDataChanged: (cb) => addListener('data-changed', cb as Function),
  getHistory: (limit = 50) => invoke<TranscriptEntry[]>('get_history', { limit }),
  clearHistory: () => invoke('clear_history'),
  getInsights: () => invoke<InsightsData>('get_insights'),
  onHistoryDelete: (id) => invoke('delete_history', { id }).then(() => {}),
  getRuntimeStatus: async () => {
    const settings = await soravo.getSettings()
    const status = await invoke<any>('get_runtime_status', { model: settings.model || 'tiny.en' })
    return { binary: status.binary, model: status.model, modelPresent: status.modelPresent }
  },
  listModels: () => invoke<ModelInfo[]>('list_models'),
  downloadModel: (id) => invoke('download_model', { id }),
  deleteModel: (id) => invoke('delete_model', { id }),
  setActiveModel: (id) => invoke('set_active_model', { id }),
  onModelDownloadProgress: (cb) => addListener('model-download-progress', cb as Function),
  onModelDownloadComplete: (cb) => addListener('model-download-complete', cb as Function),
  winMin: () => invoke('win_min'),
  winMax: () => invoke('win_max'),
  winClose: () => invoke('win_close'),
  setTextareaFocus: (focused) => invoke('set_textarea_focus', { focused }),
  getSnippets: () => invoke<Snippet[]>('get_snippets'),
  addSnippet: (phrase, expansion) => invoke<Snippet>('add_snippet', { phrase, expansion }),
  updateSnippet: (id, patch) => invoke('update_snippet', { id, patch }),
  deleteSnippet: (id) => invoke('delete_snippet', { id }),
  getScratchpadNotes: () => invoke<ScratchpadNote[]>('get_scratchpad_notes'),
  addScratchpadNote: (text) => invoke<ScratchpadNote>('add_scratchpad_note', { text }),
  deleteScratchpadNote: (id) => invoke('delete_scratchpad_note', { id }),
  updateScratchpadNote: (id, patch) => invoke('update_scratchpad_note', { id, patch }),
  onScratchpadChanged: (cb) => addListener('scratchpad-changed', cb as Function),
  openScratchpadWindow: () => invoke('open_scratchpad_window'),
  getSettings: async () => {
    const raw = await invoke<any>('get_settings')
    return settingsFromTauri(raw)
  },
  setSettings: async (patch) => {
    const tauriPatch: Record<string, unknown> = {}
    if (patch.hotkey !== undefined) tauriPatch.hotkey = patch.hotkey
    if (patch.pasteHotkey !== undefined) tauriPatch.pasteHotkey = patch.pasteHotkey
    if (patch.copyHotkey !== undefined) tauriPatch.copyHotkey = patch.copyHotkey
    if (patch.holdToTalk !== undefined) tauriPatch.holdToTalk = patch.holdToTalk
    if (patch.model !== undefined) tauriPatch.model = patch.model
    if (patch.language !== undefined) tauriPatch.language = patch.language
    if (patch.microphoneId !== undefined) tauriPatch.microphoneId = patch.microphoneId
    if (patch.sounds !== undefined) tauriPatch.sounds = patch.sounds
    if (patch.smartCleanup !== undefined) tauriPatch.smartCleanup = patch.smartCleanup
    if (patch.addPunctuation !== undefined) tauriPatch.addPunctuation = patch.addPunctuation
    if (patch.vocabulary !== undefined) tauriPatch.vocabulary = patch.vocabulary
    if (patch.launchAtLogin !== undefined) tauriPatch.launchAtLogin = patch.launchAtLogin
    if (patch.theme !== undefined) tauriPatch.theme = patch.theme
    if (patch.retention !== undefined) tauriPatch.retention = patch.retention
    const raw = await invoke<any>('set_settings', { patch: tauriPatch })
    return settingsFromTauri(raw)
  },
  validateBinding: (accel) => invoke<boolean>('validate_binding', { accel }),
  bindingHelp: () => invoke<Record<string, string[]>>('binding_help'),
}

// Expose on window for compatibility
;(window as any).soravo = soravo

export default soravo
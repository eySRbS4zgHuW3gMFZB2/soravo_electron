import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { PILL_ANCHORS, type PillAnchor } from './pillAnchors'

export type RecState = 'idle' | 'recording' | 'transcribing' | 'error'

export interface SessionInfo {
  id: number
  handsFree: boolean
}

export { PILL_ANCHORS }
export type { PillAnchor }

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
/** "system" follows the operating system's light/dark preference. */
export type Theme = 'light' | 'dark' | 'system'

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
  /** Shortcut that jumps to the Scratchpad tab. Empty means unbound. */
  scratchpadHotkey: string
  /** Whether the navigation rail shows its labels. */
  sidebarOpen: boolean
  /** Where the transcription models are downloaded. Empty means the default. */
  modelsDir: string
  /** Where the pill docks on screen. */
  pillAnchor: PillAnchor
}

export interface ModelInfo {
  id: string
  name: string
  sizeBytes: number
  sizeLabel: string
  license: string
  /** The model is ready to use: the weights, whole, and the files the
   *  engine reads from beside them. */
  installed: boolean
  /** The model's file is on disk, even if it is incomplete. */
  present: boolean
  active: boolean
  url: string
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
  /** Map to a single hotkey press. Kept for compatibility. */
  toggle(): Promise<void>
  /** Map to a single hotkey press. Kept for compatibility. */
  startRecording(): Promise<void>
  /** Map to a hotkey release. Kept for compatibility. */
  stopRecording(): Promise<void>
  quit(): Promise<void>
  getState(): Promise<RecState>
  /** Hands-free state for initial sync after mount. */
  getHandsFree(): Promise<SessionInfo>
  onState(cb: (s: RecState) => void): () => void
  /** Emitted on every session begin and on PTT→hands-free conversion. */
  onSession(cb: (s: SessionInfo) => void): () => void
  onRecordCommand(cb: (cmd: { command: 'start' | 'stop' | 'cancel'; session: number }) => void): () => void
  /** The hotkey went down. Both the rdev hook and webviews call this. */
  hotkeyPress(): Promise<void>
  /** The hotkey went up. */
  hotkeyRelease(): Promise<void>
  submitAudio(wav: ArrayBuffer, durationMs: number): Promise<void>
  cancel(): Promise<void>
  /** Finish recording and transcribe (tick). */
  finishRecording(): Promise<void>
  /** Toggle a persistent, hands-free dictation ("Dictate now" button). */
  handsFreeToggle(): Promise<void>
  /** Report a renderer-side failure (mic could not be opened, …). */
  notifyError(message: string): Promise<void>
  setPillAnchor(anchor: PillAnchor): Promise<void>
  getPillAnchor(): Promise<PillAnchor>
  /** Show the full-screen placement window. */
  openPlacementMode(): Promise<void>
  /** Hide the placement window. */
  closePlacementMode(): Promise<void>
  /** Flash the pill at the configured anchor as placement feedback. */
  flashPillPreview(): Promise<void>
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
  /** Fires when the placement preview asks the pill to flash at its anchor. */
  onPillFlash(cb: () => void): () => void
  /** Fires every time placement mode is shown, so the window can re-read the anchor. */
  onPlacementShown(cb: () => void): () => void
  openScratchpadWindow(): Promise<void>
  setTextareaFocus(focused: boolean): Promise<void>
  getSnippets(): Promise<Snippet[]>
  addSnippet(phrase: string, expansion: string): Promise<Snippet>
  updateSnippet(id: number, patch: { phrase?: string; expansion?: string }): Promise<void>
  deleteSnippet(id: number): Promise<void>
  getSettings(): Promise<SoravoSettings>
  setSettings(patch: Partial<SoravoSettings>): Promise<SoravoSettings>
  /** The folder the transcription models are downloaded into. */
  modelsFolder(): Promise<string>
  /** The default models folder, for the "reset" action. */
  defaultModelsFolder(): Promise<string>
  /** Open a folder in the operating system's file manager. */
  openFolder(path: string): Promise<void>
  /** Open an https link in the operating system's browser. */
  openLink(url: string): Promise<void>
  /** Store a value in OS-protected storage. */
  secureStoreSet(key: string, value: string): Promise<void>
  /** Retrieve a value from OS-protected storage. */
  secureStoreGet(key: string): Promise<string | null>
  /** Remove a value from OS-protected storage. */
  secureStoreDelete(key: string): Promise<void>
  /** The running app's version. */
  appVersion(): Promise<string>
  validateBinding(accel: string): Promise<boolean>
  bindingHelp(): Promise<Record<string, string[]>>
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
    scratchpadHotkey: s.scratchpadHotkey ?? s.scratchpad_hotkey ?? '',
    sidebarOpen: s.sidebarOpen ?? s.sidebar_open ?? true,
    modelsDir: s.modelsDir ?? s.models_dir ?? '',
    pillAnchor: s.pillAnchor ?? s.pill_anchor ?? 'bottom-center',
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
  await listen('soravo:session', (event) => {
    const cbs = listeners['session']
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
  await listen('soravo:pill-flash', () => {
    const cbs = listeners['pill-flash']
    if (cbs) cbs.forEach((cb) => cb())
  })
  await listen('soravo:placement-shown', () => {
    const cbs = listeners['placement-shown']
    if (cbs) cbs.forEach((cb) => cb())
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
  startRecording: () => invoke('start_record'),
  stopRecording: () => invoke('stop_record'),
  quit: () => invoke('quit'),
  getState: () => invoke<RecState>('get_state'),
  getHandsFree: () => invoke<SessionInfo>('get_hands_free'),
  onState: (cb) => addListener('state', cb as Function),
  onSession: (cb) => addListener('session', cb as Function),
  onRecordCommand: (cb) => addListener('record-command', cb as Function),
  hotkeyPress: () => invoke('hotkey_press'),
  hotkeyRelease: () => invoke('hotkey_release'),
  submitAudio: async (wav, durationMs) => {
    const arr = new Uint8Array(wav)
    await invoke('submit_audio', { wav: Array.from(arr), durationMs })
  },
  cancel: () => invoke('cancel'),
  finishRecording: () => invoke('finish_recording'),
  handsFreeToggle: () => invoke('hands_free_toggle'),
  notifyError: (message: string) => invoke('notify_error', { message }),
  setPillAnchor: (anchor) => invoke('set_pill_anchor', { anchor }),
  getPillAnchor: () => invoke<PillAnchor>('get_pill_anchor'),
  openPlacementMode: () => invoke('open_placement_mode'),
  closePlacementMode: () => invoke('close_placement_mode'),
  flashPillPreview: () => invoke('flash_pill_preview'),
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
  onPlacementShown: (cb) => addListener('placement-shown', cb as Function),
  onPillFlash: (cb) => addListener('pill-flash', cb as Function),
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
    if (patch.pillAnchor !== undefined) tauriPatch.pillAnchor = patch.pillAnchor
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
    if (patch.scratchpadHotkey !== undefined) tauriPatch.scratchpadHotkey = patch.scratchpadHotkey
    if (patch.sidebarOpen !== undefined) tauriPatch.sidebarOpen = patch.sidebarOpen
    if (patch.modelsDir !== undefined) tauriPatch.modelsDir = patch.modelsDir
    const raw = await invoke<any>('set_settings', { patch: tauriPatch })
    return settingsFromTauri(raw)
  },
  validateBinding: (accel) => invoke<boolean>('validate_binding', { accel }),
  bindingHelp: () => invoke<Record<string, string[]>>('binding_help'),
  modelsFolder: () => invoke<string>('models_folder'),
  defaultModelsFolder: () => invoke<string>('default_models_folder'),
  openFolder: (path) => invoke<void>('open_folder', { path }),
  openLink: (url) => invoke<void>('open_link', { url }),
  secureStoreSet: (key, value) => invoke<void>('secure_store_set', { key, value }),
  secureStoreGet: (key) => invoke<string | null>('secure_store_get', { key }),
  secureStoreDelete: (key) => invoke<void>('secure_store_delete', { key }),
  appVersion: () => invoke<string>('app_version'),
}

// Expose on window for compatibility
;(window as any).soravo = soravo

declare global {
  interface Window {
    soravo: SoravoAPI
  }
}

export default soravo
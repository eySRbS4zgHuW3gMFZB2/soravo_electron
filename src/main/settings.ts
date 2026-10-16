import Store from 'electron-store'

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

const defaults: SoravoSettings = {
  hotkey: 'CommandOrControl+Alt+Space',
  pasteHotkey: 'CommandOrControl+Alt+V',
  copyHotkey: 'CommandOrControl+Alt+C',
  model: 'base.en',
  language: 'en',
  microphoneId: '',
  sounds: true,
  smartCleanup: true,
  vocabulary: {},
  launchAtLogin: false,
  theme: 'light',
  retention: 'all'
}

export const settings = new Store<SoravoSettings>({
  name: 'soravo-settings',
  defaults
})

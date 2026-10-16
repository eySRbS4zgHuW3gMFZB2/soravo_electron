import Store from 'electron-store'

export interface SoravoSettings {
  /** Electron accelerator, e.g. CommandOrControl+Alt+Space */
  hotkey: string
  /** whisper.cpp model id, e.g. base.en (file ggml-base.en.bin) */
  model: string
  /** whisper language code, e.g. en */
  language: string
}

const defaults: SoravoSettings = {
  hotkey: 'CommandOrControl+Alt+Space',
  model: 'base.en',
  language: 'en'
}

export const settings = new Store<SoravoSettings>({
  name: 'soravo-settings',
  defaults
})

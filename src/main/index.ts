import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron'
import { existsSync } from 'fs'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { addTranscription, clearTranscriptions, deleteTranscription, listTranscriptions, openHistory } from './history.js'
import { injectText } from './inject.js'
import { settings, type SoravoSettings } from './settings.js'
import { runtimeStatus, transcribeWav, writeTempWav } from './whisper.js'

type RecState = 'idle' | 'recording' | 'transcribing' | 'error'

let win: BrowserWindow | null = null
let hubWin: BrowserWindow | null = null
let tray: Tray | null = null
let state: RecState = 'idle'
let hideTimer: NodeJS.Timeout | null = null
let audioTimer: NodeJS.Timeout | null = null

function setState(next: RecState): void {
  state = next
  console.log('[soravo] state ->', next)
  win?.webContents.send('soravo:state', next)
}

function fail(message: string): void {
  if (audioTimer) {
    clearTimeout(audioTimer)
    audioTimer = null
  }
  console.log('[soravo] error:', message)
  win?.webContents.send('soravo:error', message)
  setState('error')
  scheduleHide(4000)
  setTimeout(() => {
    if (state === 'error') setState('idle')
  }, 4000)
}

function preloadFile(): string {
  const dir = join(__dirname, '../preload')
  for (const name of ['index.cjs', 'index.mjs', 'index.js']) {
    const candidate = join(dir, name)
    if (existsSync(candidate)) return candidate
  }
  return join(dir, 'index.cjs')
}

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(app.getAppPath(), 'resources', 'icon.ico')
}

function createTray(): void {
  const image = nativeImage.createFromPath(iconPath())
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('Soravo — voice typing')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Soravo', click: () => showHub() },
      { label: 'Toggle dictation', click: () => void toggle() },
      { type: 'separator' },
      { label: 'Quit Soravo', click: () => app.quit() }
    ])
  )
  tray.on('click', () => showHub())
}

function attachDiagnostics(w: BrowserWindow): void {
  w.webContents.on('console-message', (_e, params) => {
    const message =
      typeof params === 'string' ? params : (params as { message?: string }).message
    if (message) console.log('[renderer]', message)
  })
  w.webContents.on('preload-error', (_e, preloadPath, error) => {
    console.log('[soravo] preload-error:', preloadPath, String(error))
  })
  w.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.log('[soravo] did-fail-load:', code, desc, url)
  })
}

function createHubWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  hubWin = new BrowserWindow({
    width: Math.min(1240, width - 80),
    height: Math.min(800, height - 80),
    minWidth: 960,
    minHeight: 600,
    frame: false,
    transparent: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadFile(),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  attachDiagnostics(hubWin)
  if (process.env['ELECTRON_RENDERER_URL']) {
    void hubWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/hub`)
  } else {
    void hubWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/hub' })
  }
  if (process.env.SORAVO_DEVTOOLS === '1') hubWin.webContents.openDevTools({ mode: 'detach' })
}

function showHub(): void {
  if (!hubWin) return
  if (hubWin.isMinimized()) hubWin.restore()
  hubWin.show()
  hubWin.focus()
}

function createWindow(): void {
  const area = screen.getPrimaryDisplay().workArea
  win = new BrowserWindow({
    width: 210,
    height: 56,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: preloadFile(),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  attachDiagnostics(win)
  win.setPosition(Math.round(area.x + (area.width - 210) / 2), area.y + area.height - 56 - 28)
  console.log('[soravo] window created, preload:', preloadFile())
  if (process.env.SORAVO_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' })
}

function showPill(): void {
  if (win && !win.isVisible()) win.showInactive()
}

function scheduleHide(ms = 2500): void {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    win?.hide()
    hideTimer = null
  }, ms)
}

let lastToggleAt = 0

async function toggle(): Promise<void> {
  console.log('[soravo] toggle, state was:', state)
  // Ignore key-repeat/double-fire within 800ms: holding the hotkey must
  // not instantly stop the recording it just started.
  const now = Date.now()
  if (now - lastToggleAt < 800) {
    console.log('[soravo] toggle debounced')
    return
  }
  lastToggleAt = now
  if (!win) return
  if (state === 'idle' || state === 'error') {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    setState('recording')
    showPill()
    win.webContents.send('soravo:record-command', 'start')
  } else if (state === 'recording') {
    setState('transcribing')
    win.webContents.send('soravo:record-command', 'stop')
    if (audioTimer) clearTimeout(audioTimer)
    audioTimer = setTimeout(() => fail('No audio arrived from the recorder'), 15000)
  }
  // transcribing: ignore extra toggles
}

function registerHotkey(): void {
  globalShortcut.unregisterAll()
  const accelerator = settings.get('hotkey')
  try {
    const ok = globalShortcut.register(accelerator, () => void toggle())
    if (!ok) win?.webContents.send('soravo:error', `Hotkey "${accelerator}" is already in use`)
  } catch (err) {
    win?.webContents.send(
      'soravo:error',
      `Invalid hotkey "${accelerator}": ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

function registerIpc(): void {
  ipcMain.handle('soravo:toggle', () => toggle())
  ipcMain.handle('soravo:quit', () => app.quit())
  ipcMain.handle('soravo:cancel', () => {
    if (audioTimer) {
      clearTimeout(audioTimer)
      audioTimer = null
    }
    win?.webContents.send('soravo:record-command', 'cancel')
    if (state !== 'idle') setState('idle')
    scheduleHide()
  })
  ipcMain.handle('soravo:get-state', () => state)
  ipcMain.handle('soravo:history', (_e, limit: number) =>
    listTranscriptions(typeof limit === 'number' ? limit : 50)
  )
  ipcMain.handle('soravo:history-clear', () => {
    clearTranscriptions()
  })
  ipcMain.handle('soravo:history-delete', (_e, id: number) => {
    if (typeof id === 'number') deleteTranscription(id)
  })
  ipcMain.handle('soravo:runtime-status', () => runtimeStatus(settings.get('model')))
  ipcMain.handle('soravo:win-min', () => hubWin?.minimize())
  ipcMain.handle('soravo:win-max', () => {
    if (!hubWin) return
    if (hubWin.isMaximized()) hubWin.unmaximize()
    else hubWin.maximize()
  })
  ipcMain.handle('soravo:win-close', () => hubWin?.hide())
  ipcMain.handle('soravo:settings-get', () => settings.store)
  ipcMain.handle('soravo:settings-set', (_e, patch: Partial<SoravoSettings>) => {
    if (typeof patch.hotkey === 'string') settings.set('hotkey', patch.hotkey)
    if (typeof patch.model === 'string') settings.set('model', patch.model)
    if (typeof patch.language === 'string') settings.set('language', patch.language)
    registerHotkey()
    return settings.store
  })
  ipcMain.handle('soravo:set-height', (_e, px: number) => {
    if (!win) return
    const area = screen.getPrimaryDisplay().workArea
    const height = Math.min(Math.max(Math.round(px), 84), 520)
    const bounds = win.getBounds()
    win.setBounds({ ...bounds, height, y: area.y + area.height - height - 28 })
  })
  ipcMain.handle('soravo:submit-audio', async (_e, wav: ArrayBuffer, durationMs: number) => {
    if (audioTimer) {
      clearTimeout(audioTimer)
      audioTimer = null
    }
    if (!(wav instanceof ArrayBuffer) || wav.byteLength === 0) {
      fail('Recording produced no audio')
      return
    }
    const wavPath = await writeTempWav(wav)
    try {
      const text = (
        await transcribeWav(wavPath, settings.get('model'), settings.get('language'))
      ).trim()
      if (!text) throw new Error('Transcription came back empty')
      addTranscription(text, typeof durationMs === 'number' ? Math.round(durationMs) : null)
      await injectText(text)
      win?.webContents.send('soravo:transcript', text)
      scheduleHide()
      setState('idle')
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err))
    } finally {
      await unlink(wavPath).catch(() => {})
    }
  })
}

void app.whenReady().then(() => {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  openHistory()
  createWindow()
  createHubWindow()
  createTray()
  registerIpc()
  registerHotkey()
  console.log('[soravo] ready, hotkey:', settings.get('hotkey'))
  // First-run visibility: show the pill briefly so the app doesn't look dead.
  setState('idle')
  showPill()
  scheduleHide(6000)
  showHub()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

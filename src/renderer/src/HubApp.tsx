import { useEffect, useState } from 'react'
import type { InsightsData, RecState, SoravoSettings, Theme, TranscriptEntry } from './soravo'
import HotkeyCapture from './HotkeyCapture'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  BrainIcon,
  ChartIcon,
  CloseIcon,
  DictionaryIcon,
  FolderIcon,
  HelpIcon,
  HistoryIcon,
  MaximizeIcon,
  MicIcon,
  MinimizeIcon,
  MonitorIcon,
  MoonIcon,
  PanelIcon,
  SettingsIcon,
  SnippetsIcon,
  ScratchpadIcon,
  StyleIcon,
  SunIcon
} from '@/components/icons'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import ScratchpadPage from './pages/ScratchpadPage'
import SnippetsPage from './pages/SnippetsPage'
import DictationPage from './pages/DictationPage'
import HistoryPage from './pages/HistoryPage'
import InsightsPage from './pages/InsightsPage'
import ModelsPage from './pages/ModelsPage'
import DictionaryPage from './pages/DictionaryPage'
import StylePage from './pages/StylePage'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Info as InfoIcon } from 'lucide-react'
import { RefreshIcon } from '@/components/pages/icons'

type Page = 'dictation' | 'history' | 'insights' | 'dictionary' | 'snippets' | 'style' | 'models' | 'scratchpad'
type SettingsTab = 'general' | 'system' | 'account' | 'billing' | 'privacy'

/** Where the builds are published. The update check opens this page. */
const RELEASES_URL = 'https://github.com/eySRbS4zgHuW3gMFZB2/soravo_electron/releases'

function fmtHotkey(accelerator: string): string {
  return accelerator.replace(/CommandOrControl/gi, 'Ctrl').split('+').join(' + ')
}

interface MicDevice {
  deviceId: string
  label: string
}

function Titlebar({
  theme,
  resolved,
  onTheme,
  onToggleTheme,
  sidebarOpen,
  onToggleSidebar
}: {
  theme: 'light' | 'dark' | 'system'
  resolved: 'light' | 'dark'
  onTheme: (next: 'light' | 'dark' | 'system') => void
  onToggleTheme: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  return (
    <div className="hub-titlebar">
      {/* The wordmark lives in the navigation rail, the way Wispr Flow does it.
          The strip carries the rail toggle and the window buttons. */}
      <div className="hub-titlebar-left">
        <Button
          variant="ghost"
          size="icon-sm"
          className="hub-winbtn"
          title={sidebarOpen ? 'Collapse the sidebar' : 'Expand the sidebar'}
          aria-label={sidebarOpen ? 'Collapse the sidebar' : 'Expand the sidebar'}
          onClick={onToggleSidebar}
        >
          <PanelIcon />
        </Button>
      </div>
      <div className="hub-titlebar-right">
        {/* One click flips the theme. The three-way choice lives in Settings. */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="hub-winbtn"
          title={resolved === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          aria-label={resolved === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          onClick={onToggleTheme}
        >
          {resolved === 'dark' ? <MoonIcon /> : <SunIcon />}
        </Button>
        <Button variant="ghost" size="icon-sm" className="hub-winbtn" title="Minimize" onClick={() => void window.soravo.winMin()}>
          <MinimizeIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" className="hub-winbtn" title="Maximize" onClick={() => void window.soravo.winMax()}>
          <MaximizeIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" className="hub-winbtn close" title="Close to tray" onClick={() => void window.soravo.winClose()}>
          <CloseIcon />
        </Button>
      </div>
    </div>
  )
}

function Sidebar({
  page,
  go,
  open,
  onOpenSettings,
  onOpenHelp
}: {
  page: Page
  go: (p: Page) => void
  open: boolean
  onOpenSettings: () => void
  onOpenHelp: () => void
}) {
  // Nav items are full-bleed rows, so they must not inherit the button's
  // default centring or inset padding. Each one carries a floating label that
  // appears on hover while the rail is collapsed, the way Wispr Flow's does.
  const navItem = (target: Page, label: string, icon: React.ReactNode) => (
    <Button
      variant="ghost"
      className={cn('hub-nav w-full justify-start', page === target && 'active')}
      onClick={() => go(target)}
      aria-current={page === target ? 'page' : undefined}
      data-testid={`sidebar-item-${target}`}
    >
      {icon}
      <span className="hub-nav-label">{label}</span>
      <span className="hub-nav-hint" aria-hidden="true">
        {label}
      </span>
    </Button>
  )

  const footItem = (label: string, icon: React.ReactNode, onClick: () => void, extra?: string) => (
    <Button
      variant="ghost"
      className={cn('hub-nav w-full justify-start', extra)}
      onClick={onClick}
    >
      {icon}
      <span className="hub-nav-label">{label}</span>
      <span className="hub-nav-hint" aria-hidden="true">
        {label}
      </span>
    </Button>
  )

  return (
    <aside className={cn('hub-sidebar', !open && 'hub-sidebar-collapsed')}>
      <div className="hub-brand">
        <span className="hub-brand-mark" aria-hidden="true">
          S
        </span>
        <span className="hub-brand-name">Soravo</span>
        {/* h-auto: the registry's Badge pins h-5, but this pill is sized by its own
            padding. inline-block: Badge defaults to inline-flex, which changes
            the line box and made the row taller. */}
        <Badge className="hub-badge h-auto inline-block border-0">Local</Badge>
      </div>

      <nav className="hub-nav-list" aria-label="Main">
        {navItem('dictation', 'Dictation', <MicIcon />)}
        {navItem('history', 'History', <HistoryIcon />)}
        {navItem('insights', 'Insights', <ChartIcon />)}
        {navItem('dictionary', 'Dictionary', <DictionaryIcon />)}
        {navItem('snippets', 'Snippets', <SnippetsIcon />)}
        {navItem('style', 'Style', <StyleIcon />)}
        {navItem('models', 'Models', <BrainIcon />)}
        {navItem('scratchpad', 'Scratchpad', <ScratchpadIcon />)}
      </nav>

      <div className="hub-sidebar-foot">
        <div className="hub-local-card">
          <p className="hub-local-title">Local &amp; private</p>
          <p className="hub-local-text">No account. No cloud. Audio never leaves this PC.</p>
        </div>
        {footItem('Settings', <SettingsIcon />, onOpenSettings)}
        {footItem('Help', <HelpIcon />, onOpenHelp, 'hub-nav-external')}
      </div>
    </aside>
  )
}

/**
 * Explanatory "i" affordance beside a label.
 *
 * The bubble is drawn by CSS rather than by a Radix portal: inside a modal
 * dialog a portalled bubble fights the dialog's own layer stack, and a plain
 * hover/focus bubble behaves the same in both themes. The text stays in the
 * DOM and is wired up with aria-describedby, so a screen reader reads it.
 */
function Hint({ text }: { text: string }) {
  return (
    <span className="hint-wrap">
      <button type="button" className="hint-dot" aria-label={text} aria-describedby="hint-bubble">
        <InfoIcon aria-hidden="true" />
      </button>
      <span role="tooltip" id="hint-bubble" className="hint-bubble">
        {text}
      </span>
    </span>
  )
}

function SubModal({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // Controlled for the same reason as the settings dialog: Radix only restores
    // <body> pointer-events when it observes open go true -> false.
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="sub-dialog">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Button
          variant="ghost"
          size="icon-sm"
          className="modal-close"
          title="Close"
          onClick={onClose}
        >
          <CloseIcon />
        </Button>
        <h2 className="modal-title">{title}</h2>
        {subtitle ? <p className="modal-sub">{subtitle}</p> : null}
        <div className="sub-dialog-body">{children}</div>
        {footer ? <div className="sub-dialog-foot">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  )
}

function SettingsModal({
  open,
  settings,
  historyCount,
  onSave,
  onClearHistory,
  onQuit,
  onClose
}: {
  open: boolean
  settings: SoravoSettings
  historyCount: number
  onSave: (patch: Partial<SoravoSettings>) => Promise<void>
  onClearHistory: () => void
  onQuit: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<SettingsTab>('general')
  const [hotkey, setHotkey] = useState(settings.hotkey)
  const [pasteHotkey, setPasteHotkey] = useState(settings.pasteHotkey)
  const [copyHotkey, setCopyHotkey] = useState(settings.copyHotkey)
  const [scratchpadHotkey, setScratchpadHotkey] = useState(settings.scratchpadHotkey ?? '')
  const [holdToTalk, setHoldToTalk] = useState(settings.holdToTalk)
  const [language, setLanguage] = useState(settings.language)
  const [microphoneId, setMicrophoneId] = useState(settings.microphoneId)
  const [sounds, setSounds] = useState(settings.sounds)
  const [smartCleanup, setSmartCleanup] = useState(settings.smartCleanup)
  const [addPunctuation, setAddPunctuation] = useState(settings.addPunctuation)
  const [vocabulary, setVocabulary] = useState<Record<string, string>>(settings.vocabulary)
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')
  const [launchAtLogin, setLaunchAtLogin] = useState(settings.launchAtLogin)
  const [theme, setTheme] = useState<Theme>(settings.theme)
  const [retention, setRetention] = useState<'all' | '30days' | 'session'>(settings.retention)
  const [devices, setDevices] = useState<MicDevice[]>([])
  const [sub, setSub] = useState<null | 'shortcuts' | 'microphone' | 'language'>(null)
  const [savedTick, setSavedTick] = useState(false)
  const [modelsFolder, setModelsFolder] = useState('')
  const [version, setVersion] = useState('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => {
    window.soravo
      .modelsFolder()
      .then(setModelsFolder)
      .catch(() => setModelsFolder(''))
    window.soravo
      .appVersion()
      .then(setVersion)
      .catch(() => setVersion(''))
  }, [settings.modelsDir])

  const updateLabel = checkingUpdate ? 'Checking for updates…' : version ? `Soravo ${version}` : 'Check for updates'

  /** Look for a newer build. Soravo has no auto-updater, so this opens the
      project's releases page, where the newest build is published. */
  const checkForUpdates = () => {
    if (checkingUpdate) return
    setCheckingUpdate(true)
    window.soravo
      .openLink(RELEASES_URL)
      .catch((e) => console.error('Could not open the releases page', e))
      .finally(() => setTimeout(() => setCheckingUpdate(false), 1200))
  }

  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) =>
        setDevices(
          all
            .filter((d) => d.kind === 'audioinput')
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
        )
      )
      .catch(() => setDevices([]))
  }, [])

  // This dialog has to stay mounted so Radix can see open go true -> false,
  // which means its local state survives a close. Previously the whole
  // component unmounted, so every reopen started from a fresh copy of the
  // saved settings on the General tab. Re-seed on open to keep that.
  useEffect(() => {
    if (!open) return
    setTab('general')
    setHotkey(settings.hotkey)
    setPasteHotkey(settings.pasteHotkey)
    setCopyHotkey(settings.copyHotkey)
    setScratchpadHotkey(settings.scratchpadHotkey ?? '')
    setHoldToTalk(settings.holdToTalk)
    setLanguage(settings.language)
    setMicrophoneId(settings.microphoneId)
    setSounds(settings.sounds)
    setSmartCleanup(settings.smartCleanup)
    setAddPunctuation(settings.addPunctuation)
    setVocabulary(settings.vocabulary)
    setNewFrom('')
    setNewTo('')
    setLaunchAtLogin(settings.launchAtLogin)
    setTheme(settings.theme)
    setRetention(settings.retention)
    setSub(null)
    setSavedTick(false)
    // Only on the open transition: settings must not clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /** Pick a folder for the transcription models. */
  const chooseModelsFolder = async () => {
    try {
      const picked = await openDialog({
        directory: true,
        multiple: false,
        title: 'Choose the models folder'
      })
      if (typeof picked === 'string' && picked) {
        await onSave({ modelsDir: picked })
        setModelsFolder(picked)
      }
    } catch (e) {
      console.error('Could not choose a models folder', e)
    }
  }

  /** Go back to the default location under the app data directory. */
  const resetModelsFolder = async () => {
    try {
      await onSave({ modelsDir: '' })
      const fallback = await window.soravo.defaultModelsFolder()
      setModelsFolder(fallback)
    } catch (e) {
      console.error('Could not reset the models folder', e)
    }
  }

  const addWord = () => {    const from = newFrom.trim()
    const to = newTo.trim()
    if (!from || !to) return
    setVocabulary((v) => ({ ...v, [from]: to }))
    setNewFrom('')
    setNewTo('')
  }

  const removeWord = (from: string) => {
    setVocabulary((v) => {
      const next = { ...v }
      delete next[from]
      return next
    })
  }

  const save = () => {
    void onSave({
      hotkey: hotkey.trim() || 'CommandOrControl+Alt+Space',
      pasteHotkey: pasteHotkey.trim(),
      copyHotkey: copyHotkey.trim(),
      scratchpadHotkey: scratchpadHotkey.trim(),
      holdToTalk,
      language: language.trim() || 'en',
      microphoneId,
      sounds,
      smartCleanup,
      addPunctuation,
      vocabulary,
      launchAtLogin,
      theme,
      retention
    }).then(() => {
      setSavedTick(true)
      setTimeout(() => setSavedTick(false), 2000)
    })
  }

  const vocabEntries = Object.entries(vocabulary)
  const microphoneLabel = microphoneId
    ? (devices.find((d) => d.deviceId === microphoneId)?.label ?? 'Custom device')
    : 'Auto-detect'

  // The shell matches Wispr Flow's: SETTINGS holds the app's own pages,
  // ACCOUNT holds the ones that describe who you are and what you pay.
  const tabs: Array<{ id: SettingsTab; label: string; group: 'settings' | 'account' }> = [
    { id: 'general', label: 'General', group: 'settings' },
    { id: 'system', label: 'System', group: 'settings' },
    { id: 'account', label: 'Account', group: 'account' },
    { id: 'billing', label: 'Plans & Billing', group: 'account' },
    { id: 'privacy', label: 'Data & Privacy', group: 'account' }
  ]

  return (
    // Controlled, not `open` hardcoded to true: Radix's modal Dialog sets
    // pointer-events:none on <body> while open, and that is only released when
    // it sees open go true -> false. Unmounting it instead leaves the whole
    // app unclickable.
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="settings-dialog">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <aside className="modal-sidebar">
          <p className="modal-heading">Settings</p>
          {tabs.map((t, index) => {
            // The group label heads the first item of its group only.
            const startsGroup =
              index === 0 || tabs[index - 1].group !== t.group
            return (
              <div key={t.id}>
                {startsGroup && t.group === 'account' ? (
                  <p className="modal-group">Account</p>
                ) : null}
                <Button
                  variant="ghost"
                  className={cn('modal-tab w-full justify-start', tab === t.id && 'active')}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </Button>
              </div>
            )
          })}
          {/* The update check sits at the foot of the rail, the way it does
              in Wispr Flow's settings. */}
          <button
            type="button"
            className="modal-update"
            onClick={checkForUpdates}
            title="Check for updates"
          >
            <RefreshIcon size={14} className={checkingUpdate ? 'animate-spin' : undefined} />
            <span>{updateLabel}</span>
          </button>
        </aside>
        <div className="modal-content">
          <Button variant="ghost" size="icon-sm" className="modal-close" title="Close without saving" onClick={onClose}>
            <CloseIcon />
          </Button>

          {tab === 'general' && (
            <div className="modal-scroll">
              <h2 className="settings-page-title">General</h2>
              <div className="settings-card">
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Shortcuts</span>
                    <span className="settings-row-desc">
                      Hold {fmtHotkey(hotkey)} and speak.
                    </span>
                  </div>
                  <div className="settings-row-control">
                    <Button variant="outline" size="sm" onClick={() => setSub('shortcuts')}>
                      Change
                    </Button>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Microphone</span>
                    <span className="settings-row-desc">{microphoneLabel}</span>
                  </div>
                  <div className="settings-row-control">
                    <Button variant="outline" size="sm" onClick={() => setSub('microphone')}>
                      Change
                    </Button>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Dictation language</span>
                    <span className="settings-row-desc">{language || 'en'}</span>
                  </div>
                  <div className="settings-row-control">
                    <Button variant="outline" size="sm" onClick={() => setSub('language')}>
                      Change
                    </Button>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Theme</span>
                    <span className="settings-row-desc">Light, dark, or follow the system.</span>
                  </div>
                  <div className="settings-row-control">
                    <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
                      <SelectTrigger style={{ width: 160 }}>
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="light">
                            <SunIcon />
                            Light
                          </SelectItem>
                          <SelectItem value="dark">
                            <MoonIcon />
                            Dark
                          </SelectItem>
                          <SelectItem value="system">
                            <MonitorIcon />
                            System
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Sound effects</span>
                    <span className="settings-row-desc">
                      Play a sound when dictation starts and finishes.
                    </span>
                  </div>
                  <div className="settings-row-control">
                    <Switch checked={sounds} onCheckedChange={(c) => setSounds(c === true)} />
                  </div>
                </div>
              </div>

              {sub === 'shortcuts' && (
                <SubModal
                  open
                  title="Shortcuts"
                  subtitle="Choose your preferred shortcuts for using Soravo."
                  onClose={() => setSub(null)}
                  footer={
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setHotkey('CommandOrControl+Alt+Space')
                          setPasteHotkey('CommandOrControl+Alt+V')
                          setCopyHotkey('CommandOrControl+Alt+C')
                          setScratchpadHotkey('')
                        }}
                      >
                        Reset to default
                      </Button>
                      <Button onClick={() => setSub(null)}>Done</Button>
                    </>
                  }
                >
                  <p className="shortcut-section">Dictation</p>
                  <div className="shortcut-grid">
                    <span className="shortcut-label">Dictate</span>
                    <HotkeyCapture value={hotkey} onCommit={setHotkey} />
                  </div>
                  <div className="shortcut-grid" style={{ marginTop: 12 }}>
                    <span className="shortcut-label">Push to talk</span>
                    <div>
                      <Checkbox
                        checked={holdToTalk}
                        onCheckedChange={(c) => setHoldToTalk(c === true)}
                        aria-label="Push to talk"
                      />
                    </div>
                  </div>
                  <p className="page-dialog-note" style={{ marginTop: 12 }}>
                    {holdToTalk
                      ? 'Hold the dictate shortcut to record. Release to transcribe.'
                      : 'Press to start, press again to stop and transcribe.'}
                  </p>
                  <div className="shortcut-grid" style={{ marginTop: 12 }}>
                    <span className="shortcut-label">Paste last</span>
                    <HotkeyCapture value={pasteHotkey} allowEmpty onCommit={setPasteHotkey} />
                  </div>
                  <div className="shortcut-grid" style={{ marginTop: 12 }}>
                    <span className="shortcut-label">Copy last</span>
                    <HotkeyCapture value={copyHotkey} allowEmpty onCommit={setCopyHotkey} />
                  </div>

                  <hr className="shortcut-divider" />

                  <p className="shortcut-section">Scratchpad</p>
                  <div className="shortcut-grid">
                    <span className="shortcut-label">Open Scratchpad</span>
                    <HotkeyCapture value={scratchpadHotkey} allowEmpty onCommit={setScratchpadHotkey} />
                  </div>
                  <p className="page-dialog-note" style={{ marginTop: 12 }}>
                    Press to jump straight to the Scratchpad tab from anywhere in the hub.
                  </p>

                  <p className="page-dialog-note" style={{ marginTop: 16 }}>
                    Shortcuts accept any key on its own (CapsLock, F-keys, letters) or any mouse
                    button, with or without Ctrl, Alt, Shift or Win.
                  </p>
                </SubModal>
              )}
              {sub === 'microphone' && (
                <SubModal open title="Microphone" subtitle="Used for dictation." onClose={() => setSub(null)}>
                  <div className="row">
                    <label>Input</label>
                    <Select
                      // Radix rejects an empty-string item value, so map
                      // auto-detect onto a sentinel and back on the way out.
                      value={microphoneId === '' ? 'auto' : microphoneId}
                      onValueChange={(v) => setMicrophoneId(v === 'auto' ? '' : v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Auto-detect" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="auto">Auto-detect</SelectItem>
                          {devices.map((d) => (
                            <SelectItem key={d.deviceId} value={d.deviceId}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </SubModal>
              )}
              {sub === 'language' && (
                <SubModal open title="Dictation language" subtitle="Whisper language code, e.g. en, es, fr. Also tunes cleanup rules." onClose={() => setSub(null)}>
                  <div className="row">
                    <label>Language</label>
                    <Input value={language} onChange={(e) => setLanguage(e.target.value)} spellCheck={false} />
                  </div>
                </SubModal>
              )}
            </div>
          )}

          {tab === 'system' && (
            <div className="modal-scroll">
              <h2 className="settings-page-title">System</h2>

              <div className="settings-section">
                <p className="settings-section-title">App settings</p>
                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">Launch app at login</span>
                      <span className="settings-row-desc">
                        Runs Soravo as soon as you sign in to Windows.
                      </span>
                    </div>
                    <div className="settings-row-control">
                      <Switch checked={launchAtLogin} onCheckedChange={(c) => setLaunchAtLogin(c === true)} />
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">Smart cleanup</span>
                      <span className="settings-row-desc">
                        Strips filler words like um, uh, er, ah and hmm, then tidies spacing. Your custom
                        vocabulary is always applied, whether this is on or off.
                      </span>
                    </div>
                    <div className="settings-row-control">
                      <Switch checked={smartCleanup} onCheckedChange={(c) => setSmartCleanup(c === true)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <p className="settings-section-title">Sound</p>
                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">Dictation and notification sounds</span>
                    </div>
                    <div className="settings-row-control">
                      <Switch checked={sounds} onCheckedChange={(c) => setSounds(c === true)} />
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">Add punctuation</span>
                      <span className="settings-row-desc">
                        Adds a full stop when dictation ends without a period, exclamation mark or question mark.
                      </span>
                    </div>
                    <div className="settings-row-control">
                      <Switch checked={addPunctuation} onCheckedChange={(c) => setAddPunctuation(c === true)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <p className="settings-section-title">Notifications</p>
                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        Suggestions
                        <Hint text="Soravo has no telemetry, so these tips are generated on this device only." />
                      </span>
                      <span className="settings-row-desc">
                        Tips about getting set up or improving how you use Soravo.
                      </span>
                    </div>
                    <div className="settings-row-control">
                      <Switch checked={false} disabled />
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <p className="settings-section-title">Custom vocabulary ({vocabEntries.length})</p>
                <div className="settings-card">
                  {vocabEntries.length === 0 ? (
                    <div className="settings-row">
                      <div className="settings-row-text">
                        <span className="settings-row-desc">
                          No words yet. Add a phrase you say often and what it should be written as.
                        </span>
                      </div>
                    </div>
                  ) : (
                    vocabEntries.map(([from, to]) => (
                      <div className="settings-row" key={from}>
                        <div className="settings-row-text">
                          <span className="settings-row-label">{from}</span>
                          <span className="settings-row-desc">Written as {to}</span>
                        </div>
                        <div className="settings-row-control">
                          <Button variant="ghost" size="sm" onClick={() => removeWord(from)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">Heard as</span>
                      <Input
                        value={newFrom}
                        onChange={(e) => setNewFrom(e.target.value)}
                        placeholder="e.g. sore avo"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">Write as</span>
                      <Input
                        value={newTo}
                        onChange={(e) => setNewTo(e.target.value)}
                        placeholder="e.g. Soravo"
                        spellCheck={false}
                      />
                    </div>
                    <div className="settings-row-control">
                      <Button variant="outline" size="sm" onClick={addWord}>
                        Add word
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <p className="settings-section-title">Models folder</p>
                <div className="settings-card">
                  <div className="settings-row">
                    <div className="settings-row-text">
                      <span className="settings-row-label">Downloads to</span>
                      <button
                        type="button"
                        className="settings-link"
                        onClick={() => void window.soravo.openFolder(modelsFolder)}
                        title="Open the models folder"
                      >
                        {modelsFolder}
                      </button>
                    </div>
                    <div className="settings-row-control">
                      <Button variant="outline" size="sm" onClick={chooseModelsFolder}>
                        Change
                      </Button>
                      {settings.modelsDir ? (
                        <Button variant="ghost" size="sm" onClick={resetModelsFolder}>
                          Reset
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <Button variant="destructive" size="sm" className="system-quit" onClick={onQuit}>
                  Quit Soravo
                </Button>
              </div>
            </div>
          )}

          {tab === 'account' && (
            <div className="modal-scroll">
              <h2 className="settings-page-title">Account</h2>
              {/* The profile header, the way Wispr Flow's account page opens
                  with the person before the details. Soravo's profile is the
                  local one, so the mark stands in for an avatar. */}
              <div className="account-profile">
                <span className="account-avatar" aria-hidden="true">
                  S
                </span>
                <div className="account-profile-text">
                  <p className="account-profile-name">Local profile</p>
                  <p className="account-profile-sub">
                    This device is the whole account. Nothing is signed in and nothing is sent
                    anywhere.
                  </p>
                </div>
              </div>
              <div className="settings-card">
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Signed in as</span>
                    <span className="settings-row-desc">Nobody - Soravo has no accounts.</span>
                  </div>
                </div>
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Active model</span>
                    <span className="settings-row-desc">{settings.model || 'none selected'}</span>
                  </div>
                </div>
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Models folder</span>
                    <button
                      type="button"
                      className="settings-link"
                      onClick={() => void window.soravo.openFolder(modelsFolder)}
                      title="Open the models folder"
                    >
                      {modelsFolder}
                    </button>
                  </div>
                </div>
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Version</span>
                    <span className="settings-row-desc">
                      {version ? `Soravo ${version}` : 'alpha'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'billing' && (
            <div className="modal-scroll">
              <h2 className="settings-page-title">Plans &amp; Billing</h2>
              <p className="modal-sub">
                Soravo is free, and there is no bill. There is no subscription to manage, no card on
                file and no invoice to download.
              </p>
              <div className="settings-card">
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Current plan</span>
                    <span className="settings-row-desc">Free, forever - everything runs on this device.</span>
                  </div>
                </div>
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Billing details</span>
                    <span className="settings-row-desc">None. Soravo never contacts a payment provider.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="modal-scroll">
              <h2 className="settings-page-title">Data &amp; Privacy</h2>
              <div className="hub-local-card" style={{ marginBottom: 20 }}>
                <p className="hub-local-title">Everything stays on this PC</p>
                <p className="hub-local-text">
                  No account, no cloud, no telemetry. Audio is transcribed locally and only the
                  resulting text is kept in a SQLite database on this machine.
                </p>
              </div>
              <div className="settings-card">
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">History keeps</span>
                    <span className="settings-row-desc">How long past dictations are kept.</span>
                  </div>
                  <div className="settings-row-control">
                    {/* Same pill treatment as Theme, for the same reason. */}
                    <ToggleGroup
                      type="single"
                      value={retention}
                      onValueChange={(v) => v && setRetention(v as 'all' | '30days' | 'session')}
                      spacing={0}
                      className="seg"
                    >
                      <ToggleGroupItem value="all">Everything</ToggleGroupItem>
                      <ToggleGroupItem value="30days">30 days</ToggleGroupItem>
                      <ToggleGroupItem value="session">Session</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Saved transcripts</span>
                    <span className="settings-row-desc">{historyCount} on this machine.</span>
                  </div>
                  <div className="settings-row-control">
                    <Button variant="destructive-outline" size="sm" onClick={onClearHistory}>
                      Delete all
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="modal-foot">
            <span className="modal-version">Soravo alpha</span>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={save}>
              {savedTick ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="sub-dialog">
        <DialogTitle className="sr-only">Help</DialogTitle>
        <Button variant="ghost" size="icon-sm" className="modal-close" title="Close" onClick={onClose}>
          <CloseIcon />
        </Button>
        <h2 className="modal-title">Help</h2>
        <p className="modal-sub">Soravo runs entirely on this machine. Here is the short version.</p>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">Dictate</span>
              <span className="settings-row-desc">
                Press the hotkey, speak, then press it again. The text lands wherever you were typing.
              </span>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">Snippets</span>
              <span className="settings-row-desc">
                Save the text you retype often, then say the trigger word to drop it in.
              </span>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">Dictionary</span>
              <span className="settings-row-desc">
                Add the words you say often so they are always spelled your way.
              </span>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">Scratchpad</span>
              <span className="settings-row-desc">
                A scratch space for half-formed thoughts. Bind a shortcut to jump straight to it.
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function HubApp() {
  const [page, setPage] = useState<Page>('dictation')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [state, setState] = useState<RecState>('idle')
  const [lastText, setLastText] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<TranscriptEntry[]>([])
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [settings, setSettings] = useState<SoravoSettings | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  // The operating system's light/dark preference, for the "system" theme.
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  // Kept locally as well as in the settings, so the rail reacts to the toggle
  // at once and never flips while the settings are being read.
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (settings?.sidebarOpen !== undefined) setSidebarOpen(settings.sidebarOpen)
  }, [settings?.sidebarOpen])

  const refreshHistory = () => {
    window.soravo.getHistory(200).then(setHistory).catch(() => {})
  }

  useEffect(() => {
    window.soravo.getState().then(setState).catch(() => {})
    window.soravo.getSettings().then(setSettings).catch(() => {})
    refreshHistory()
    const offState = window.soravo.onState(setState)
    const offText = window.soravo.onTranscript((text) => {
      setLastText(text)
      setError('')
      refreshHistory()
    })
    const offError = window.soravo.onError(setError)
    const offData = window.soravo.onDataChanged(() => {
      refreshHistory()
      window.soravo.getInsights().then(setInsights).catch(() => {})
    })
    return () => {
      offState()
      offText()
      offError()
      offData()
    }
  }, [])

  // "system" follows the operating system, so it has to track the OS setting
  // changing while the app is open.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const theme = settings?.theme ?? 'light'

  useEffect(() => {
    document.documentElement.dataset.theme =
      theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  }, [theme, systemDark])

  // The Scratchpad tab can rebind its own shortcut, so re-read the settings
  // whenever the hub navigates back out of a tab.
  useEffect(() => {
    window.soravo.getSettings().then(setSettings).catch(() => {})
  }, [page])

  // The Scratchpad shortcut jumps to that tab from anywhere in the hub.
  useEffect(() => {
    const accelerator = settings?.scratchpadHotkey
    if (!accelerator) return
    const parts = accelerator.toLowerCase().split('+')
    const needsCtrl = parts.includes('commandorcontrol') || parts.includes('ctrl') || parts.includes('control')
    const needsAlt = parts.includes('alt')
    const needsShift = parts.includes('shift')
    const trigger = parts.filter(
      (p) => !['commandorcontrol', 'ctrl', 'control', 'alt', 'shift', 'meta', 'super'].includes(p)
    )[0]
    if (!trigger) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (needsCtrl !== (e.ctrlKey || e.metaKey)) return
      if (needsAlt !== e.altKey) return
      if (needsShift !== e.shiftKey) return
      if (e.key.toLowerCase() !== trigger) return
      e.preventDefault()
      setPage('scratchpad')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settings?.scratchpadHotkey])

  useEffect(() => {
    window.soravo.getInsights().then(setInsights).catch(() => setInsights(null))
  }, [page, lastText])

  const copyEntry = (id: number, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(id)
        setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500)
      },
      () => {
        setError('Copy failed in this window.')
      }
    )
  }

  const deleteEntry = (id: number) => {
    window.soravo.onHistoryDelete(id).then(refreshHistory).catch(() => {})
  }

  const saveSettings = async (patch: Partial<SoravoSettings>) => {
    const updated = await window.soravo.setSettings(patch)
    setSettings(updated)
  }

  // What the app is actually showing right now, whether that is the chosen
  // theme or the system's.
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  return (
      <div className="hub-root">
        <Titlebar
          theme={theme}
          resolved={resolvedTheme}
          sidebarOpen={sidebarOpen}
          onTheme={(next) => void saveSettings({ theme: next })}
          onToggleTheme={() => void saveSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' })}
          onToggleSidebar={() => {
            const next = !sidebarOpen
            setSidebarOpen(next)
            void saveSettings({ sidebarOpen: next })
          }}
        />
        <div className="hub-body">
          <Sidebar
            page={page}
            go={setPage}
            open={sidebarOpen}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
          />
          <main className="hub-content">
            {page === 'dictation' && (
              <DictationPage
                history={history}
                settings={settings}
                state={state}
                lastText={error || lastText}
                copiedId={copiedId}
                onCopy={copyEntry}
                onDelete={deleteEntry}
                onToggle={() => void window.soravo.toggle()}
                onOpenStyle={() => setPage('style')}
                onOpenDictionary={() => setPage('dictionary')}
              />
            )}
            {page === 'history' && (
              <HistoryPage
                history={history}
                copiedId={copiedId}
                onCopy={copyEntry}
                onDelete={deleteEntry}
                onClear={() => void window.soravo.clearHistory().then(refreshHistory)}
                onRefresh={refreshHistory}
              />
            )}
            {page === 'insights' && <InsightsPage insights={insights} />}
            {page === 'dictionary' && (
              <DictionaryPage
                settings={settings}
                onSave={saveSettings}
                onRefresh={() => void window.soravo.getSettings().then(setSettings).catch(() => {})}
              />
            )}
            {page === 'snippets' && <SnippetsPage />}
            {page === 'style' && <StylePage settings={settings} onSave={saveSettings} />}
            {page === 'models' && <ModelsPage />}
            {page === 'scratchpad' && <ScratchpadPage />}
          </main>
        </div>
        {settings ? (
          <SettingsModal
            open={settingsOpen}
            settings={settings}
            historyCount={history.length}
            onSave={saveSettings}
            onClearHistory={() => void window.soravo.clearHistory().then(refreshHistory)}
            onQuit={() => void window.soravo.quit()}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null}
        <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
  )
}

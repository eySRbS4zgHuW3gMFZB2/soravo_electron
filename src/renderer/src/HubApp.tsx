import { useEffect, useState } from 'react'
import type { InsightsData, RecState, SoravoSettings, TranscriptEntry } from './soravo'
import HotkeyCapture from './HotkeyCapture'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  BrainIcon,
  ChartIcon,
  CloseIcon,
  DictionaryIcon,
  HelpIcon,
  HistoryIcon,
  MaximizeIcon,
  MicIcon,
  MinimizeIcon,
  MoonIcon,
  SettingsIcon,
  SnippetsIcon,
  ScratchpadIcon,
  StyleIcon,
  SunIcon
} from '@/components/icons'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

type Page = 'dictation' | 'history' | 'insights' | 'dictionary' | 'snippets' | 'style' | 'models' | 'scratchpad'
type SettingsTab = 'general' | 'system' | 'privacy'

function fmtHotkey(accelerator: string): string {
  return accelerator.replace(/CommandOrControl/gi, 'Ctrl').split('+').join(' + ')
}

interface MicDevice {
  deviceId: string
  label: string
}

function Titlebar({
  theme,
  onTheme
}: {
  theme: 'light' | 'dark'
  onTheme: (next: 'light' | 'dark') => void
}) {
  return (
    <div className="hub-titlebar">
      {/* The wordmark lives in the navigation rail, the way Wispr Flow does it.
          The strip itself stays empty so the window can be dragged by it. */}
      <div className="hub-titlebar-left" />
      <div className="hub-titlebar-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="hub-winbtn" title="Theme">
              {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onTheme('light')}>
              <SunIcon />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onTheme('dark')}>
              <MoonIcon />
              Dark
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
  onOpenSettings,
  onOpenHelp
}: {
  page: Page
  go: (p: Page) => void
  onOpenSettings: () => void
  onOpenHelp: () => void
}) {
  // Nav items are full-bleed rows, so they must not inherit the button's
  // default centring or inset padding.
  const navItem = (target: Page, label: string, icon: React.ReactNode) => (
    <Button
      variant="ghost"
      className={cn('hub-nav w-full justify-start', page === target && 'active')}
      onClick={() => go(target)}
    >
      {icon}
      <span>{label}</span>
    </Button>
  )

  return (
    <aside className="hub-sidebar">
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

      {navItem('dictation', 'Dictation', <MicIcon />)}
      {navItem('history', 'History', <HistoryIcon />)}
      {navItem('insights', 'Insights', <ChartIcon />)}
      {navItem('dictionary', 'Dictionary', <DictionaryIcon />)}
      {navItem('snippets', 'Snippets', <SnippetsIcon />)}
      {navItem('style', 'Style', <StyleIcon />)}
      {navItem('models', 'Models', <BrainIcon />)}
      {navItem('scratchpad', 'Scratchpad', <ScratchpadIcon />)}

      <div className="hub-sidebar-foot">
        <div className="hub-local-card">
          <p className="hub-local-title">Local &amp; private</p>
          <p className="hub-local-text">No account. No cloud. Audio never leaves this PC.</p>
        </div>
        <Button variant="ghost" className="hub-nav w-full justify-start" onClick={onOpenSettings}>
          <SettingsIcon />
          <span>Settings</span>
        </Button>
        <Button variant="ghost" className="hub-nav hub-nav-external w-full justify-start" onClick={onOpenHelp}>
          <HelpIcon />
          <span>Help</span>
        </Button>
      </div>
    </aside>
  )
}

/**
 * Explanatory "i" affordance beside a label. The bubble keeps the app's own
 * look via .hint-bubble; Radix supplies the positioning, collision handling
 * and keyboard wiring.
 */
function Hint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="hint-dot" aria-label={text}>
          i
        </button>
      </TooltipTrigger>
      {/* side/align reproduce the old hand-rolled placement, which put the
          bubble 8px below the dot and left-aligned to it. */}
      <TooltipContent className="hint-bubble" side="bottom" align="start" sideOffset={8}>
        {text}
      </TooltipContent>
    </Tooltip>
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
  const [theme, setTheme] = useState<'light' | 'dark'>(settings.theme)
  const [retention, setRetention] = useState<'all' | '30days' | 'session'>(settings.retention)
  const [devices, setDevices] = useState<MicDevice[]>([])
  const [sub, setSub] = useState<null | 'shortcuts' | 'microphone' | 'language'>(null)
  const [savedTick, setSavedTick] = useState(false)

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

  const addWord = () => {
    const from = newFrom.trim()
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

  const tabs: Array<{ id: SettingsTab; label: string; group: 'settings' | 'data' }> = [
    { id: 'general', label: 'General', group: 'settings' },
    { id: 'system', label: 'System', group: 'settings' },
    { id: 'privacy', label: 'Data & Privacy', group: 'data' }
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
          {tabs.map((t) => (
            <div key={t.id}>
              {t.group === 'data' ? <p className="modal-group">Data</p> : null}
              <Button
                variant="ghost"
                className={cn('modal-tab w-full justify-start', tab === t.id && 'active')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Button>
            </div>
          ))}
        </aside>
        <div className="modal-content">
          <Button variant="ghost" size="icon-sm" className="modal-close" title="Close without saving" onClick={onClose}>
            <CloseIcon />
          </Button>

          {tab === 'general' && (
            <div className="modal-scroll">
              <h2 className="modal-title">General</h2>
              <div className="settings-card">
                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Shortcuts</span>
                    <span className="settings-row-desc">
                      Hold {fmtHotkey(hotkey)} and speak.
                    </span>
                  </div>
                  <div className="settings-row-control">
                    <Button variant="secondary" onClick={() => setSub('shortcuts')}>
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
                    <Button variant="secondary" onClick={() => setSub('microphone')}>
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
                    <Button variant="secondary" onClick={() => setSub('language')}>
                      Change
                    </Button>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-row-text">
                    <span className="settings-row-label">Theme</span>
                    <span className="settings-row-desc">Light or dark, across the whole app.</span>
                  </div>
                  <div className="settings-row-control">
                    <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark')}>
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
              <h2 className="modal-title">System</h2>

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
                      <Button variant="secondary" onClick={addWord}>
                        Add word
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <Button variant="destructive" className="system-quit" onClick={onQuit}>
                  Quit Soravo
                </Button>
              </div>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="modal-scroll">
              <h2 className="modal-title">Data &amp; Privacy</h2>
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
                    <Button variant="destructive" onClick={onClearHistory}>
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

  useEffect(() => {
    document.documentElement.dataset.theme = settings?.theme ?? 'light'
  }, [settings])

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

  const theme = settings?.theme ?? 'light'

  return (
    <TooltipProvider delayDuration={200}>
      <div className="hub-root">
        <Titlebar
          theme={theme}
          onTheme={(next) => void saveSettings({ theme: next })}
        />
        <div className="hub-body">
          <Sidebar
            page={page}
            go={setPage}
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
    </TooltipProvider>
  )
}

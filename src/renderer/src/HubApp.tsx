import { useEffect, useMemo, useRef, useState } from 'react'
import type { InsightsData, RecState, SoravoSettings, TranscriptEntry } from './soravo'
import { soravo } from './soravo'
import HotkeyCapture from './HotkeyCapture'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  BrainIcon,
  ChartIcon,
  CloseIcon,
  CopyIcon,
  HistoryIcon,
  MaximizeIcon,
  MicIcon,
  MinimizeIcon,
  ScratchpadIcon,
  SettingsIcon,
  SnippetsIcon,
  TrashIcon
} from '@/components/icons'
import ScratchpadPage from './ScratchpadPage'
import SnippetsPage from './SnippetsPage'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
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
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Page = 'dictation' | 'history' | 'insights' | 'models' | 'scratchpad' | 'snippets'
type SettingsTab = 'general' | 'system' | 'privacy'

function fmtHotkey(accelerator: string): string {
  return accelerator.replace(/CommandOrControl/gi, 'Ctrl').split('+').join(' + ')
}

function timeHM(iso: string): string {
  const d = new Date(iso)
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = d.getHours() >= 12 ? 'pm' : 'am'
  const hours = d.getHours() % 12 || 12
  return `${hours}:${minutes}${ampm}`
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function useStats(history: TranscriptEntry[]) {
  return useMemo(() => {
    let words = 0
    let rateWords = 0
    let rateMs = 0
    const days = new Set<string>()
    for (const h of history) {
      const w = countWords(h.text)
      words += w
      days.add(dayKey(new Date(h.createdAt)))
      if (h.durationMs && h.durationMs > 0) {
        rateWords += w
        rateMs += h.durationMs
      }
    }
    let streak = 0
    const cursor = new Date()
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
    while (days.has(dayKey(cursor))) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return {
      words,
      wpm: rateMs > 0 ? Math.round((rateWords / rateMs) * 60000) : 0,
      streak
    }
  }, [history])
}

function Titlebar() {
  return (
    <div className="hub-titlebar">
      <div className="hub-titlebar-left">
        <span className="hub-wordmark">Soravo</span>
        {/* h-auto: the registry's Badge pins h-5, but this pill is sized by its own
            padding. inline-block: Badge defaults to inline-flex, which changes
            the line box and made the titlebar 3px taller, shifting every page
            below it. */}
        {/* h-auto drops the registry's fixed h-5, inline-block restores the original
            inline-block box, and border-0 drops its 1px transparent border -
            that border alone made the titlebar 2px taller and shifted every
            page below it. */}
        <Badge className="hub-badge h-auto inline-block border-0">Local</Badge>
      </div>
      <div className="hub-titlebar-right">
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
  onOpenSettings
}: {
  page: Page
  go: (p: Page) => void
  onOpenSettings: () => void
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
      {navItem('dictation', 'Dictation', <MicIcon />)}
      {navItem('history', 'History', <HistoryIcon />)}
      {navItem('insights', 'Insights', <ChartIcon />)}
      {navItem('models', 'Models', <BrainIcon />)}
      {navItem('scratchpad', 'Scratchpad', <ScratchpadIcon />)}
      {navItem('snippets', 'Snippets', <SnippetsIcon />)}
      <Button variant="ghost" className="hub-nav w-full justify-start" onClick={onOpenSettings}>
        <SettingsIcon />
        <span>Settings</span>
      </Button>
      <div className="hub-sidebar-foot">
        <div className="hub-local-card">
          <p className="hub-local-title">Local &amp; private</p>
          <p className="hub-local-text">No account. No cloud. Audio never leaves this PC.</p>
        </div>
      </div>
    </aside>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="hub-stat">
      <div className="hub-stat-value">
        {value} <span>{label}</span>
      </div>
    </div>
  )
}

function EntryRow({
  entry,
  copied,
  onCopy,
  onDelete
}: {
  entry: TranscriptEntry
  copied: boolean
  onCopy: () => void
  onDelete?: () => void
}) {
  return (
    <div className="hub-entry">
      <div className="hub-entry-time">{timeHM(entry.createdAt)}</div>
      <p className="hub-entry-text">{entry.text}</p>
      <div className="hub-entry-actions">
        <Button variant="ghost" size="icon" className="hub-mini-btn" title="Copy text" onClick={onCopy}>
          {copied ? 'Copied' : <CopyIcon />}
        </Button>
        {onDelete && (
          <Button variant="ghost" size="icon" className="hub-mini-btn danger" title="Delete" onClick={onDelete}>
            <TrashIcon />
          </Button>
        )}
      </div>
    </div>
  )
}

function DictationPage({
  history,
  settings,
  state,
  lastText,
  copiedId,
  onCopy,
  onToggle
}: {
  history: TranscriptEntry[]
  settings: SoravoSettings | null
  state: RecState
  lastText: string
  copiedId: number | null
  onCopy: (id: number, text: string) => void
  onToggle: () => void
}) {
  const stats = useStats(history)
  const today = history.filter((h) => dayKey(new Date(h.createdAt)) === dayKey(new Date()))
  const statusLine =
    state === 'recording'
      ? 'Listening… press the hotkey again to finish'
      : state === 'transcribing'
        ? 'Transcribing locally…'
        : state === 'error'
          ? 'Something went wrong — try again'
          : lastText
            ? lastText
            : 'Press the button or hotkey and start talking'
  return (
    <div className="hub-columns">
      <div className="hub-main-col">
        <h1 className="hub-greeting">
          Hey, get into the flow with <span className="hub-hotkey">{fmtHotkey(settings?.hotkey ?? '…')}</span>
        </h1>
        <div className="hub-hero">
          <div>
            <h2>Try Soravo in another app</h2>
            <p>Soravo works anywhere you type.</p>
            <Button  onClick={onToggle}>
              {state === 'recording' ? 'Stop dictating' : 'Dictate now'}
            </Button>
          </div>
          <div className="hub-hero-mark">S</div>
        </div>
        <div className="hub-live">{statusLine}</div>
        <h3 className="hub-section">Today</h3>
        <div className="hub-entries">
          {today.length === 0 && <p className="history-empty">Nothing dictated yet today.</p>}
          {today.map((h) => (
            <EntryRow key={h.id} entry={h} copied={copiedId === h.id} onCopy={() => onCopy(h.id, h.text)} />
          ))}
        </div>
      </div>
      <div className="hub-side-col">
        <StatCard value={String(stats.words)} label="total words" />
        <StatCard value={String(stats.wpm)} label="wpm" />
        <StatCard value={String(stats.streak)} label="day streak" />
      </div>
    </div>
  )
}

function HistoryPage({
  history,
  copiedId,
  onCopy,
  onDelete,
  onClear,
  onRefresh
}: {
  history: TranscriptEntry[]
  copiedId: number | null
  onCopy: (id: number, text: string) => void
  onDelete: (id: number) => void
  onClear: () => void
  onRefresh: () => void
}) {
  const [filter, setFilter] = useState('')
  const shown = history.filter((h) =>
    filter.trim() === '' ? true : h.text.toLowerCase().includes(filter.trim().toLowerCase())
  )
  return (
    <div className="hub-page">
      <h1 className="hub-greeting">History</h1>
      <div className="row">
        <Input
          placeholder="Search dictations…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button variant="secondary" onClick={onRefresh}>
          Refresh
        </Button>
        {history.length > 0 && (
          <Button variant="destructive" onClick={onClear}>
            Clear all
          </Button>
        )}
      </div>
      <div className="hub-entries">
        {shown.length === 0 && <p className="history-empty">No matching dictations.</p>}
        {shown.map((h) => (
          <EntryRow
            key={h.id}
            entry={h}
            copied={copiedId === h.id}
            onCopy={() => onCopy(h.id, h.text)}
            onDelete={() => onDelete(h.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface MicDevice {
  deviceId: string
  label: string
}

/**
 * Small "i" affordance that reveals an explanatory bubble on hover or focus.
 * The bubble is position:fixed and measured from the trigger, because the
 * settings body scrolls and would otherwise clip an absolutely-ploned tooltip.
 */
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
  children
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
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
        {subtitle ? <p className="hub-note">{subtitle}</p> : null}
        {children}
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
  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'general', label: 'General' },
    { id: 'system', label: 'System' },
    { id: 'privacy', label: 'Data & Privacy' }
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
            <Button
              key={t.id}
              variant="ghost"
              className={cn('modal-tab w-full justify-start', tab === t.id && 'active')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </aside>
        <div className="modal-content">
          <Button variant="ghost" size="icon-sm" className="modal-close" title="Close without saving" onClick={onClose}>
            <CloseIcon />
          </Button>

          {tab === 'general' && (
            <div>
              <h2 className="modal-title">General</h2>
              <div className="row">
                <label>Shortcuts</label>
                <span className="row-summary">{fmtHotkey(hotkey)}</span>
                <Button variant="secondary" onClick={() => setSub('shortcuts')}>
                  Change
                </Button>
              </div>
              <div className="row">
                <label>Microphone</label>
                <span className="row-summary">
                  {microphoneId
                    ? (devices.find((d) => d.deviceId === microphoneId)?.label ?? 'Custom device')
                    : 'Auto-detect'}
                </span>
                <Button variant="secondary" onClick={() => setSub('microphone')}>
                  Change
                </Button>
              </div>
              <div className="row">
                <label>Dictation language</label>
                <span className="row-summary">{language || 'en'}</span>
                <Button variant="secondary" onClick={() => setSub('language')}>
                  Change
                </Button>
              </div>
              <div className="row">
                <label>Theme</label>
                {/* className="seg" is the app's pill treatment: canvas-soft track, 9999px
                      radius, 13px semibold, lime fill with white text when on.
                      The bare ToggleGroup drew a bordered box with black text
                      instead. */}
                <ToggleGroup
                  type="single"
                  value={theme}
                  onValueChange={(v) => v && setTheme(v as 'light' | 'dark')}
                  spacing={0}
                  className="seg w-full"
                >
                  <ToggleGroupItem value="light" className="flex-1">
                    Light
                  </ToggleGroupItem>
                  <ToggleGroupItem value="dark" className="flex-1">
                    Dark
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="row">
                <label>Sound effects</label>
                <Checkbox checked={sounds} onCheckedChange={(c) => setSounds(c === true)} />
              </div>

              {sub === 'shortcuts' && (
                <SubModal open 
                  title="Shortcuts"
                  subtitle="Choose your preferred shortcuts for using Soravo."
                  onClose={() => setSub(null)}
                >
                  <div className="row">
                    <label>Dictate</label>
                    <HotkeyCapture value={hotkey} onCommit={setHotkey} />
                  </div>
                  <div className="row">
                    <label>Push to talk</label>
                    <Checkbox checked={holdToTalk} onCheckedChange={(c) => setHoldToTalk(c === true)} />
                  </div>
                  <p className="hub-note">
                    {holdToTalk
                      ? 'Hold the dictate shortcut to record. Release to transcribe.'
                      : 'Press to start, press again to stop and transcribe.'}
                  </p>
                  <div className="row">
                    <label>Paste last</label>
                    <HotkeyCapture value={pasteHotkey} allowEmpty onCommit={setPasteHotkey} />
                  </div>
                  <div className="row">
                    <label>Copy last</label>
                    <HotkeyCapture value={copyHotkey} allowEmpty onCommit={setCopyHotkey} />
                  </div>
                  <p className="hub-note">
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
                <SubModal open 
                  title="Dictation language"
                  subtitle="Whisper language code, e.g. en, es, fr. Also tunes cleanup rules."
                  onClose={() => setSub(null)}
                >
                  <div className="row">
                    <label>Language</label>
                    <Input value={language} onChange={(e) => setLanguage(e.target.value)} spellCheck={false} />
                  </div>
                </SubModal>
              )}
            </div>
          )}

          {tab === 'system' && (
            <div>
              <h2 className="modal-title">System</h2>
              <div className="row">
                <label>
                  Smart cleanup
                  <Hint text="Strips filler words like um, uh, er, ah and hmm, then tidies spacing. Your custom vocabulary is always applied, whether this is on or off." />
                </label>
                <Checkbox checked={smartCleanup} onCheckedChange={(c) => setSmartCleanup(c === true)} />
              </div>
              <div className="row">
                <label>
                  Add punctuation
                  <Hint text="Adds a full stop when a dictation ends without a period, exclamation mark or question mark. Works on its own, even when Smart cleanup is off." />
                </label>
                <Checkbox checked={addPunctuation} onCheckedChange={(c) => setAddPunctuation(c === true)} />
              </div>
              <h3 className="hub-section">Custom vocabulary ({vocabEntries.length})</h3>
              {vocabEntries.map(([from, to]) => (
                <div className="row" key={from}>
                  <label>{from}</label>
                  <Input value={to} readOnly />
                  <Button variant="destructive" onClick={() => removeWord(from)}>
                    Remove
                  </Button>
                </div>
              ))}
              <div className="row">
                <label>Heard as</label>
                <Input
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                  placeholder="e.g. sore avo"
                  spellCheck={false}
                />
              </div>
              <div className="row">
                <label>Write as</label>
                <Input
                  value={newTo}
                  onChange={(e) => setNewTo(e.target.value)}
                  placeholder="e.g. Soravo"
                  spellCheck={false}
                />
              </div>
              <div className="row">
                <label />
                <Button variant="secondary" onClick={addWord}>
                  Add word
                </Button>
              </div>
              <div className="row">
                <label title="Registers Soravo in your Windows startup folder so it runs as soon as you sign in.">
                  Start at login
                </label>
                <Checkbox checked={launchAtLogin} onCheckedChange={(c) => setLaunchAtLogin(c === true)} />
              </div>
              <div className="row">
                <Button variant="destructive" onClick={onQuit}>
                  Quit Soravo
                </Button>
              </div>
            </div>
          )}

          {tab === 'privacy' && (
            <div>
              <h2 className="modal-title">Data &amp; Privacy</h2>
              <div className="hub-local-card">
                <p className="hub-local-title">Everything stays on this PC</p>
                <p className="hub-local-text">
                  No account, no cloud, no telemetry. Audio is transcribed locally and only the
                  resulting text is kept in a SQLite database on this machine.
                </p>
              </div>
              <div className="row">
                <label>History keeps</label>
                {/* Same pill treatment as Theme, for the same reason. */}
                <ToggleGroup
                  type="single"
                  value={retention}
                  onValueChange={(v) => v && setRetention(v as 'all' | '30days' | 'session')}
                  spacing={0}
                  className="seg w-full"
                >
                  <ToggleGroupItem value="all" className="flex-1">
                    Everything
                  </ToggleGroupItem>
                  <ToggleGroupItem value="30days" className="flex-1">
                    30 days
                  </ToggleGroupItem>
                  <ToggleGroupItem value="session" className="flex-1">
                    Session
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="row">
                <label>{historyCount} saved</label>
                <Button variant="destructive" onClick={onClearHistory}>
                  Delete all transcripts
                </Button>
              </div>
            </div>
          )}

          <div className="modal-foot">
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

function WpmGauge({ avg, top }: { avg: number; top: number }) {
  const R = 88
  const ARC = Math.PI * R
  const scale = 200
  const frac = Math.min(1, avg / scale)
  const topFrac = Math.min(1, top / scale)
  const dotX = 100 - R * Math.cos(Math.PI * topFrac)
  const dotY = 100 - R * Math.sin(Math.PI * topFrac)
  return (
    <svg viewBox="0 0 200 112" className="gauge-svg">
      <path
        d="M 12 100 A 88 88 0 0 1 188 100"
        fill="none"
        stroke="var(--soravo-canvas-soft)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 12 100 A 88 88 0 0 1 188 100"
        fill="none"
        stroke="var(--soravo-primary)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${(ARC * frac).toFixed(1)} ${ARC.toFixed(1)}`}
      />
      {top > 0 && <circle cx={dotX} cy={dotY} r="5" fill="var(--soravo-ink)" />}
    </svg>
  )
}

function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [downloading, setDownloading] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [runtime, setRuntime] = useState<{ binary: boolean; model: string; modelPresent: boolean } | null>(null)

  const refresh = () => {
    window.soravo.listModels().then(setModels).catch(() => setModels([]))
    window.soravo.getRuntimeStatus().then(setRuntime).catch(() => setRuntime(null))
  }

  useEffect(() => {
    refresh()
    const offProgress = window.soravo.onModelDownloadProgress((p) => {
      if (p.id === downloading) setProgress(p.percent)
    })
    const offComplete = window.soravo.onModelDownloadComplete((p) => {
      setDownloading(null)
      setProgress(0)
      refresh()
      // Auto-activate if no active model
      window.soravo.getSettings().then((s) => {
        if (!s.model) void window.soravo.setActiveModel(p.id).then(refresh)
      }).catch(() => {})
    })
    return () => { offProgress(); offComplete() }
  }, [downloading])

  const handleDownload = (id: string) => {
    setDownloading(id)
    setProgress(0)
    setError('')
    window.soravo.downloadModel(id).catch((e) => {
      setError(String(e))
      setDownloading(null)
      setProgress(0)
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm(`Delete model ${id}?`)) return
    window.soravo.deleteModel(id).then(refresh).catch((e) => setError(String(e)))
  }

  const handleActivate = (id: string) => {
    window.soravo.setActiveModel(id).then(refresh).catch((e) => setError(String(e)))
  }

  const formatBytes = (b: number) => {
    if (b >= 1_000_000_000) return `${(b / 1_000_000_000).toFixed(1)} GB`
    return `${(b / 1_000_000).toFixed(0)} MB`
  }

  return (
    <div className="hub-page">
      <h1 className="hub-greeting">Models</h1>
      <p className="hub-sub">Download and manage transcription models. All models are MIT-licensed Whisper models.</p>
      {runtime !== null && (
        <p className="hub-note" style={{ color: runtime.binary && runtime.modelPresent ? 'var(--soravo-positive)' : 'var(--soravo-negative)' }}>
          {runtime.binary && runtime.modelPresent
            ? `Transcription engine ready — using ${runtime.model}.`
            : !runtime.binary
              ? 'Transcription engine missing. Reinstall Soravo or re-run the bundled fetch:asr script.'
              : `Transcription engine is installed, but the active model "${runtime.model}" is not. Download it below or pick another.`}
        </p>
      )}
      {error && <p className="hub-note" style={{ color: 'var(--soravo-negative)' }}>{error}</p>}
      <div className="hub-card">
        {models.map((m) => (
          <div key={m.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--soravo-canvas-soft)' }}>
            {/* flex:1/minWidth:0 holds the text column at a fixed width, and the
                action column below is a fixed 184px, so neither the wrapping
                nor the row height changes when a row gains or loses its
                Download / Set Active / Delete buttons. Without this, pressing
                Set Active made the whole list re-space itself. */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {m.sizeLabel} · {m.license} license
                {m.active && <span style={{ marginLeft: 8, color: 'var(--soravo-positive)', fontWeight: 600 }}>● Active</span>}
                {m.installed && !m.active && <span style={{ marginLeft: 8, opacity: 0.5 }}>Installed</span>}
              </div>
              {downloading === m.id && (
                <div style={{ marginTop: 8, width: 200 }}>
                  <Progress value={progress} />
                  <div style={{ fontSize: 11, marginTop: 2 }}>{progress}%</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flex: 'none', width: 184, justifyContent: 'flex-end' }}>
              {!m.installed && downloading !== m.id && (
                <Button variant="secondary" onClick={() => handleDownload(m.id)}>Download</Button>
              )}
              {downloading === m.id && (
                <Button variant="secondary" onClick={() => { setDownloading(null); setProgress(0) }}>Cancel</Button>
              )}
              {m.installed && !m.active && (
                <>
                  <Button variant="secondary" onClick={() => handleActivate(m.id)}>Set Active</Button>
                  <Button variant="secondary" onClick={() => handleDelete(m.id)}>Delete</Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="hub-note">Models are downloaded to %APPDATA%/soravo/models/. Larger models are more accurate but slower.</p>
    </div>
  )
}

function InsightsPage({ insights }: { insights: InsightsData | null }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [rhythm, setRhythm] = useState<'hour' | 'weekday' | 'month' | 'year'>('hour')
  if (!insights) {
    return (
      <div className="hub-page">
        <h1 className="hub-greeting">Insights</h1>
        <p className="history-empty">Loading…</p>
      </div>
    )
  }

  const byDate = new Map(insights.perDay.map((d) => [d.date, d.words]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * 15)
  const maxDay = Math.max(1, ...byDate.values())
  const level = (w: number) =>
    w === 0 ? 0 : w <= maxDay * 0.25 ? 1 : w <= maxDay * 0.5 ? 2 : w <= maxDay * 0.75 ? 3 : 4
  const WINDOW_WEEKS = 26
  const end = new Date(today)
  end.setDate(end.getDate() - weekOffset * 7)
  const endSunday = new Date(end)
  endSunday.setDate(end.getDate() - end.getDay())
  const gridStart = new Date(endSunday)
  gridStart.setDate(endSunday.getDate() - 7 * (WINDOW_WEEKS - 1))
  const oldest = insights.perDay.length > 0 ? insights.perDay[0].date : null
  const canEarlier = oldest !== null && gridStart > new Date(`${oldest}T00:00:00`)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const pad = (n: number) => String(n).padStart(2, '0')
  const weeks: Array<Array<{ date: Date; words: number } | null>> = []
  for (let w = 0; w < WINDOW_WEEKS; w++) {
    const col: Array<{ date: Date; words: number } | null> = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + w * 7 + d)
      if (date.getTime() > today.getTime()) {
        col.push(null)
      } else {
        const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        col.push({ date, words: byDate.get(key) ?? 0 })
      }
    }
    weeks.push(col)
  }
  // A week column belongs to the month of its last day, which is what GitHub-style
  // graphs do: the column that straddles a month boundary is labelled with the
  // month that owns most of it.
  const monthSections: { label: string; m: number; y: number; start: number; end: number; span: number }[] = []
  for (let i = 0; i < weeks.length; i++) {
    const cells = weeks[i].filter((c) => c !== null)
    if (cells.length === 0) continue
    const last = cells[cells.length - 1].date
    const m = last.getMonth()
    const y = last.getFullYear()
    const prev = monthSections[monthSections.length - 1]
    if (prev && prev.m === m && prev.y === y) prev.end = i + 1
    else monthSections.push({ label: monthNames[m], m, y, start: i, end: i + 1, span: 1 })
  }
  for (const s of monthSections) s.span = s.end - s.start
  const gridYear =
    gridStart.getFullYear() === endSunday.getFullYear()
      ? String(gridStart.getFullYear())
      : `${gridStart.getFullYear()}–${endSunday.getFullYear()}`

  const maxHour = Math.max(1, ...insights.perHour)
  const maxWeekday = Math.max(1, ...insights.perWeekday)
  const maxMonth = Math.max(1, ...insights.perMonth)
  const maxYear = Math.max(1, ...insights.perYear.map((e) => e.words))
  // Always render at least one year column so the axis is never blank.
  const yearData =
    insights.perYear.length > 0
      ? insights.perYear
      : [{ year: new Date().getFullYear(), words: 0 }]
  const yearCaption = yearData.map((e) => e.year).join('–')
  const hourLabel = (h: number) => {
    if (h === 0) return '12a'
    if (h === 12) return '12p'
    return h < 12 ? `${h}a` : `${h - 12}p`
  }
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const maxWord = Math.max(1, ...insights.topWords.map((w) => w.count))

  return (
    <div className="hub-page insights-page">
      <h1 className="hub-greeting">Insights</h1>
      <div className="insights-stats">
        <StatCard value={String(insights.words)} label="total words" />
        <StatCard value={String(insights.dictations)} label="dictations" />
        <StatCard value={String(insights.avgWpm)} label="avg wpm" />
        <StatCard value={String(insights.dayStreak)} label="day streak" />
      </div>

      <h3 className="hub-section">Fixes made by Soravo</h3>
      <div className="insights-stats">
        <StatCard value={String(insights.correctionsFillers)} label="filler words removed" />
        <StatCard value={String(insights.correctionsVocab)} label="vocabulary fixes" />
        <StatCard value={`${insights.audioMinutes}`} label="minutes dictated" />
        <StatCard value={String(insights.longestStreak)} label="longest streak" />
      </div>

      <h3 className="hub-section">Activity</h3>
      <div className="insights-duo">
        <div className="gauge-card">
          <div className="gauge-num">{insights.avgWpm}</div>
          <div className="gauge-label">WORDS PER MINUTE</div>
          <WpmGauge avg={insights.avgWpm} top={insights.topWpm} />
          <div className="gauge-top">
            {insights.topWpm > 0 ? `Top ${insights.topWpm} wpm` : 'Dictate to set a top speed'}
          </div>
        </div>
        <div className="hub-heatmap-card">
        <div className="heatmap-head">
          <span className="heatmap-streak">
            {insights.dayStreak} day streak
          </span>
          <span className="heatmap-longest">
            LONGEST STREAK | {insights.longestStreak} {insights.longestStreak === 1 ? 'DAY' : 'DAYS'}
          </span>
        </div>
        <div className="heatmap-navrow">
          <Button
            variant="ghost"
            size="icon-sm"
            className="heatmap-nav"
            title="Earlier"
            disabled={!canEarlier}
            onClick={() => setWeekOffset((o) => o + 8)}
          >
            ‹
          </Button>
          <div className="heatmap-months">
            {monthSections.map((sec, i) => (
              <span
                key={i}
                style={{ width: `${sec.span * 13 + (sec.span - 1) * 3}px`, textAlign: 'center' }}
              >
                {sec.label}
              </span>
            ))}
          </div>
          <span className="heatmap-year">{gridYear}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="heatmap-nav"
            title="Later"
            disabled={weekOffset === 0}
            onClick={() => setWeekOffset((o) => Math.max(0, o - 8))}
          >
            ›
          </Button>
        </div>
        <div className="heatmap-body">
          <div className="heatmap-days">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="heatmap">
            {weeks.map((col, wi) => (
              <div className="heatmap-col" key={wi}>
                {col.map((cell, di) =>
                  cell === null ? (
                    <span className="heatmap-cell empty" key={di} />
                  ) : (
                    <span
                      className="heatmap-cell"
                      data-level={level(cell.words)}
                      key={di}
                      title={`${cell.date.toLocaleDateString()}: ${cell.words} words`}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="heatmap-legend">
          <span>More</span>
          {[4, 3, 2, 1].map((l) => (
            <span className="heatmap-cell" data-level={l} key={l} />
          ))}
          <span>Less</span>
        </div>
        </div>
      </div>

      <h3 className="hub-section">When you dictate</h3>
      <div className="hub-rhythm-card">
        <ToggleGroup
          type="single"
          value={rhythm}
          onValueChange={(v) => v && setRhythm(v as typeof rhythm)}
          variant="outline"
          spacing={0}
          className="seg"
        >
          <ToggleGroupItem value="hour">Hour</ToggleGroupItem>
          <ToggleGroupItem value="weekday">Week</ToggleGroupItem>
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
          <ToggleGroupItem value="year">Year</ToggleGroupItem>
        </ToggleGroup>
        {rhythm === 'hour' ? (
          <div className="hub-bars">
            {insights.perHour.map((w, h) => (
              <div className="hub-bar-col" key={h} title={`${hourLabel(h)}: ${w} words`}>
                <div className="hub-bar" style={{ height: `${Math.max(3, Math.round((w / maxHour) * 72))}px` }} />
                <span>{h % 3 === 0 ? hourLabel(h) : ''}</span>
              </div>
            ))}
          </div>
        ) : rhythm === 'weekday' ? (
          <div className="hub-bars">
            {insights.perWeekday.map((w, i) => (
              <div className="hub-bar-col" key={weekdays[i]} title={`${weekdays[i]}: ${w} words`}>
                <div className="hub-bar" style={{ height: `${Math.max(3, Math.round((w / maxWeekday) * 72))}px` }} />
                <span>{weekdays[i]}</span>
              </div>
            ))}
          </div>
        ) : rhythm === 'month' ? (
          <div className="chart">
            <span className="chart-caption">{yearCaption}</span>
            <div className="hub-bars">
              {insights.perMonth.map((w, i) => (
                <div className="hub-bar-col" key={monthNames[i]} title={`${monthNames[i]}: ${w} words`}>
                  <div className="hub-bar" style={{ height: `${Math.max(3, Math.round((w / maxMonth) * 72))}px` }} />
                  <span>{monthNames[i]}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="chart">
            <span className="chart-caption">{yearCaption}</span>
            <div className="hub-bars compact">
              {yearData.map((e) => (
                <div className="hub-bar-col" key={e.year} title={`${e.year}: ${e.words} words`}>
                  <div
                    className="hub-bar"
                    style={{ height: `${Math.max(3, Math.round((e.words / maxYear) * 72))}px` }}
                  />
                  <span>{e.year}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <h3 className="hub-section">Top words</h3>
      {insights.topWords.length === 0 && <p className="history-empty">Dictate more to see your top words.</p>}
      {insights.topWords.map((w) => (
        <div className="toprow" key={w.word}>
          <span className="toprow-label">{w.word}</span>
          <div className="toprow-track">
            <div className="toprow-fill" style={{ width: `${Math.round((w.count / maxWord) * 100)}%` }} />
          </div>
          <span className="toprow-count">{w.count}</span>
        </div>
      ))}

      <h3 className="hub-section">Repeated phrases</h3>
      {insights.topPhrases.length === 0 && <p className="history-empty">No repeated phrases yet.</p>}
      {insights.topPhrases.map((p) => (
        <div className="toprow" key={p.phrase}>
          <span className="toprow-label wide">“{p.phrase}”</span>
          <span className="toprow-count">×{p.count}</span>
        </div>
      ))}
    </div>
  )
}

export default function HubApp() {
  const [page, setPage] = useState<Page>('dictation')
  const [settingsOpen, setSettingsOpen] = useState(false)
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

  useEffect(() => {
    window.soravo.getInsights().then(setInsights).catch(() => setInsights(null))
  }, [page, lastText])

  const copyEntry = (id: number, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedId(id)
        setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500)
      },
      () => setError('Copy failed in this window.')
    )
  }

  const deleteEntry = (id: number) => {
    window.soravo.onHistoryDelete(id).then(refreshHistory).catch(() => {})
  }

  const saveSettings = async (patch: Partial<SoravoSettings>) => {
    const updated = await window.soravo.setSettings(patch)
    setSettings(updated)
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="hub-root">
      <Titlebar />
      <div className="hub-body">
        <Sidebar page={page} go={setPage} onOpenSettings={() => setSettingsOpen(true)} />
        <main className="hub-content">
          {page === 'dictation' && (
            <DictationPage
              history={history}
              settings={settings}
              state={state}
              lastText={error || lastText}
              copiedId={copiedId}
              onCopy={copyEntry}
              onToggle={() => void window.soravo.toggle()}
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
           {page === 'models' && <ModelsPage />}
           {page === 'scratchpad' && <ScratchpadPage />}
           {page === 'snippets' && <SnippetsPage />}
        </main>
      </div>
      {settings && (
        <SettingsModal
          open={settingsOpen}
          settings={settings}
          historyCount={history.length}
          onSave={saveSettings}
          onClearHistory={() => void window.soravo.clearHistory().then(refreshHistory)}
          onQuit={() => void window.soravo.quit()}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      </div>
    </TooltipProvider>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { InsightsData, RecState, SoravoSettings, TranscriptEntry } from './soravo'
import HotkeyCapture from './HotkeyCapture'

type Page = 'dictation' | 'history' | 'insights' | 'models'
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

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 18v4" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 14l4-4 3 3 5-6" />
    </svg>
  )
}

function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0-3 3 3 3 0 0 0 1 5.66V17a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.34A3 3 0 0 0 20 11a3 3 0 0 0-3-3V6a4 4 0 0 0-4-4z" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  )
}

function Titlebar() {
  return (
    <div className="hub-titlebar">
      <div className="hub-titlebar-left">
        <span className="hub-wordmark">Soravo</span>
        <span className="hub-badge">Local</span>
      </div>
      <div className="hub-titlebar-right">
        <button className="hub-winbtn" title="Minimize" onClick={() => void window.soravo.winMin()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg>
        </button>
        <button className="hub-winbtn" title="Maximize" onClick={() => void window.soravo.winMax()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
        </button>
        <button className="hub-winbtn close" title="Close to tray" onClick={() => void window.soravo.winClose()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
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
  return (
    <aside className="hub-sidebar">
      <button className={page === 'dictation' ? 'hub-nav active' : 'hub-nav'} onClick={() => go('dictation')}>
        <MicIcon />
        <span>Dictation</span>
      </button>
      <button className={page === 'history' ? 'hub-nav active' : 'hub-nav'} onClick={() => go('history')}>
        <HistoryIcon />
        <span>History</span>
      </button>
      <button className={page === 'insights' ? 'hub-nav active' : 'hub-nav'} onClick={() => go('insights')}>
        <ChartIcon />
        <span>Insights</span>
      </button>
      <button className={page === 'models' ? 'hub-nav active' : 'hub-nav'} onClick={() => go('models')}>
        <BrainIcon />
        <span>Models</span>
      </button>
      <button className="hub-nav" onClick={onOpenSettings}>
        <SettingsIcon />
        <span>Settings</span>
      </button>
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
        <button className="hub-mini-btn" title="Copy text" onClick={onCopy}>
          {copied ? 'Copied' : <CopyIcon />}
        </button>
        {onDelete && (
          <button className="hub-mini-btn danger" title="Delete" onClick={onDelete}>
            <TrashIcon />
          </button>
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
            <button className="btn primary" onClick={onToggle}>
              {state === 'recording' ? 'Stop dictating' : 'Dictate now'}
            </button>
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
        <input
          placeholder="Search dictations…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="btn" onClick={onRefresh}>
          Refresh
        </button>
        {history.length > 0 && (
          <button className="btn danger" onClick={onClear}>
            Clear all
          </button>
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
function Hint({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const dot = useRef<HTMLSpanElement>(null)

  const show = () => {
    const el = dot.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = 250
    setPos({
      top: r.bottom + 8,
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    })
    setOpen(true)
  }
  const hide = () => setOpen(false)

  return (
    <>
      <span
        ref={dot}
        className="hint-dot"
        role="button"
        tabIndex={0}
        aria-label={text}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault()
          open ? hide() : show()
        }}
      >
        i
      </span>
      {open && (
        <div className="hint-bubble" role="tooltip" style={{ top: pos.top, left: pos.left }}>
          {text}
        </div>
      )}
    </>
  )
}

function SubModal({
  title,
  subtitle,
  onClose,
  children
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="modal-backdrop sub-backdrop" onClick={onClose}>
      <div
        className="modal-dialog sub-dialog"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" title="Close" onClick={onClose}>
          <CloseIcon />
        </button>
        <h2 className="modal-title">{title}</h2>
        {subtitle ? <p className="hub-note">{subtitle}</p> : null}
        {children}
      </div>
    </div>
  )
}

function SettingsModal({
  settings,
  historyCount,
  onSave,
  onClearHistory,
  onQuit,
  onClose
}: {
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <aside className="modal-sidebar">
          <p className="modal-heading">Settings</p>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'modal-tab active' : 'modal-tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </aside>
        <div className="modal-content">
          <button className="modal-close" title="Close without saving" onClick={onClose}>
            <CloseIcon />
          </button>

          {tab === 'general' && (
            <div>
              <h2 className="modal-title">General</h2>
              <div className="row">
                <label>Shortcuts</label>
                <span className="row-summary">{fmtHotkey(hotkey)}</span>
                <button className="btn" onClick={() => setSub('shortcuts')}>
                  Change
                </button>
              </div>
              <div className="row">
                <label>Microphone</label>
                <span className="row-summary">
                  {microphoneId
                    ? (devices.find((d) => d.deviceId === microphoneId)?.label ?? 'Custom device')
                    : 'Auto-detect'}
                </span>
                <button className="btn" onClick={() => setSub('microphone')}>
                  Change
                </button>
              </div>
              <div className="row">
                <label>Dictation language</label>
                <span className="row-summary">{language || 'en'}</span>
                <button className="btn" onClick={() => setSub('language')}>
                  Change
                </button>
              </div>
              <div className="row">
                <label>Theme</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="row">
                <label>Sound effects</label>
                <input type="checkbox" checked={sounds} onChange={(e) => setSounds(e.target.checked)} />
              </div>

              {sub === 'shortcuts' && (
                <SubModal
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
                    <input
                      type="checkbox"
                      checked={holdToTalk}
                      onChange={(e) => setHoldToTalk(e.target.checked)}
                    />
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
                <SubModal title="Microphone" subtitle="Used for dictation." onClose={() => setSub(null)}>
                  <div className="row">
                    <label>Input</label>
                    <select value={microphoneId} onChange={(e) => setMicrophoneId(e.target.value)}>
                      <option value="">Auto-detect</option>
                      {devices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </SubModal>
              )}
              {sub === 'language' && (
                <SubModal
                  title="Dictation language"
                  subtitle="Whisper language code, e.g. en, es, fr. Also tunes cleanup rules."
                  onClose={() => setSub(null)}
                >
                  <div className="row">
                    <label>Language</label>
                    <input value={language} onChange={(e) => setLanguage(e.target.value)} spellCheck={false} />
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
                <input
                  type="checkbox"
                  checked={smartCleanup}
                  onChange={(e) => setSmartCleanup(e.target.checked)}
                />
              </div>
              <div className="row">
                <label>
                  Add punctuation
                  <Hint text="Adds a full stop when a dictation ends without a period, exclamation mark or question mark. Works on its own, even when Smart cleanup is off." />
                </label>
                <input
                  type="checkbox"
                  checked={addPunctuation}
                  onChange={(e) => setAddPunctuation(e.target.checked)}
                />
              </div>
              <h3 className="hub-section">Custom vocabulary ({vocabEntries.length})</h3>
              {vocabEntries.map(([from, to]) => (
                <div className="row" key={from}>
                  <label>{from}</label>
                  <input value={to} readOnly />
                  <button className="btn danger" onClick={() => removeWord(from)}>
                    Remove
                  </button>
                </div>
              ))}
              <div className="row">
                <label>Heard as</label>
                <input
                  value={newFrom}
                  onChange={(e) => setNewFrom(e.target.value)}
                  placeholder="e.g. sore avo"
                  spellCheck={false}
                />
              </div>
              <div className="row">
                <label>Write as</label>
                <input
                  value={newTo}
                  onChange={(e) => setNewTo(e.target.value)}
                  placeholder="e.g. Soravo"
                  spellCheck={false}
                />
              </div>
              <div className="row">
                <label />
                <button className="btn" onClick={addWord}>
                  Add word
                </button>
              </div>
              <div className="row">
                <label title="Registers Soravo in your Windows startup folder so it runs as soon as you sign in.">
                  Start at login
                </label>
                <input
                  type="checkbox"
                  checked={launchAtLogin}
                  onChange={(e) => setLaunchAtLogin(e.target.checked)}
                />
              </div>
              <div className="row">
                <button className="btn danger" onClick={onQuit}>
                  Quit Soravo
                </button>
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
                <select
                  value={retention}
                  onChange={(e) => setRetention(e.target.value as 'all' | '30days' | 'session')}
                >
                  <option value="all">Everything</option>
                  <option value="30days">Last 30 days</option>
                  <option value="session">This session only</option>
                </select>
              </div>
              <div className="row">
                <label>{historyCount} saved</label>
                <button className="btn danger" onClick={onClearHistory}>
                  Delete all transcripts
                </button>
              </div>
            </div>
          )}

          <div className="modal-foot">
            <button className="btn" onClick={onClose}>
              Close
            </button>
            <button className="btn primary" onClick={save}>
              {savedTick ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
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
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {m.sizeLabel} · {m.license} license
                {m.active && <span style={{ marginLeft: 8, color: 'var(--soravo-positive)', fontWeight: 600 }}>● Active</span>}
                {m.installed && !m.active && <span style={{ marginLeft: 8, opacity: 0.5 }}>Installed</span>}
              </div>
              {downloading === m.id && (
                <div style={{ marginTop: 8, width: 200 }}>
                  <div style={{ height: 6, background: 'var(--soravo-canvas-soft)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'var(--soravo-primary)', transition: 'width 0.2s' }} />
                  </div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{progress}%</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!m.installed && downloading !== m.id && (
                <button className="btn" onClick={() => handleDownload(m.id)}>Download</button>
              )}
              {downloading === m.id && (
                <button className="btn" onClick={() => { setDownloading(null); setProgress(0) }}>Cancel</button>
              )}
              {m.installed && !m.active && (
                <>
                  <button className="btn" onClick={() => handleActivate(m.id)}>Set Active</button>
                  <button className="btn" onClick={() => handleDelete(m.id)}>Delete</button>
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
          <button
            className="heatmap-nav"
            title="Earlier"
            disabled={!canEarlier}
            onClick={() => setWeekOffset((o) => o + 8)}
          >
            ‹
          </button>
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
          <button
            className="heatmap-nav"
            title="Later"
            disabled={weekOffset === 0}
            onClick={() => setWeekOffset((o) => Math.max(0, o - 8))}
          >
            ›
          </button>
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
        <div className="seg">
          <button
            className={rhythm === 'hour' ? 'seg-btn active' : 'seg-btn'}
            onClick={() => setRhythm('hour')}
          >
            Hour
          </button>
          <button
            className={rhythm === 'weekday' ? 'seg-btn active' : 'seg-btn'}
            onClick={() => setRhythm('weekday')}
          >
            Week
          </button>
          <button
            className={rhythm === 'month' ? 'seg-btn active' : 'seg-btn'}
            onClick={() => setRhythm('month')}
          >
            Month
          </button>
          <button
            className={rhythm === 'year' ? 'seg-btn active' : 'seg-btn'}
            onClick={() => setRhythm('year')}
          >
            Year
          </button>
        </div>
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
        </main>
      </div>
      {settingsOpen && settings && (
        <SettingsModal
          settings={settings}
          historyCount={history.length}
          onSave={saveSettings}
          onClearHistory={() => void window.soravo.clearHistory().then(refreshHistory)}
          onQuit={() => void window.soravo.quit()}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

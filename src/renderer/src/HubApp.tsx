import { useEffect, useMemo, useState } from 'react'
import type { RecState, SoravoSettings, TranscriptEntry } from './soravo'

type Page = 'dictation' | 'history' | 'settings'

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

function Sidebar({ page, go }: { page: Page; go: (p: Page) => void }) {
  const items: Array<{ id: Page; label: string; icon: () => JSX.Element }> = [
    { id: 'dictation', label: 'Dictation', icon: MicIcon },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ]
  return (
    <aside className="hub-sidebar">
      {items.map((item) => (
        <button
          key={item.id}
          className={page === item.id ? 'hub-nav active' : 'hub-nav'}
          onClick={() => go(item.id)}
        >
          <item.icon />
          <span>{item.label}</span>
        </button>
      ))}
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

function SettingsPage({
  settings,
  onSave,
  onQuit
}: {
  settings: SoravoSettings | null
  onSave: (patch: Partial<SoravoSettings>) => Promise<void>
  onQuit: () => void
}) {
  const [hotkey, setHotkey] = useState(settings?.hotkey ?? '')
  const [model, setModel] = useState(settings?.model ?? 'base.en')
  const [language, setLanguage] = useState(settings?.language ?? 'en')
  const [runtime, setRuntime] = useState<{ binary: boolean; model: string; modelPresent: boolean } | null>(null)

  useEffect(() => {
    setHotkey(settings?.hotkey ?? '')
    setModel(settings?.model ?? 'base.en')
    setLanguage(settings?.language ?? 'en')
  }, [settings])

  useEffect(() => {
    window.soravo.getRuntimeStatus().then(setRuntime).catch(() => setRuntime(null))
  }, [])

  return (
    <div className="hub-page">
      <h1 className="hub-greeting">Settings</h1>
      <div className="row">
        <label>Hotkey</label>
        <input value={hotkey} onChange={(e) => setHotkey(e.target.value)} spellCheck={false} />
      </div>
      <div className="row">
        <label>Model</label>
        <select value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="base.en">base.en (fast, ~150MB)</option>
          <option value="small.en">small.en (better, ~500MB)</option>
        </select>
      </div>
      <div className="row">
        <label>Language</label>
        <input value={language} onChange={(e) => setLanguage(e.target.value)} spellCheck={false} />
      </div>
      <div className="row">
        <button
          className="btn primary"
          onClick={() =>
            void onSave({
              hotkey: hotkey.trim() || 'CommandOrControl+Alt+Space',
              model: model.trim() || 'base.en',
              language: language.trim() || 'en'
            })
          }
        >
          Save
        </button>
      </div>
      <h3 className="hub-section">Transcription engine</h3>
      <p className="hub-note">
        {runtime === null
          ? 'Checking…'
          : runtime.binary && runtime.modelPresent
            ? `Ready — whisper.cpp binary + model ${runtime.model} present. Nothing is downloaded at runtime.`
            : 'Incomplete — run `npm run fetch:whisper` in the Soravo project, then restart the app.'}
      </p>
      <h3 className="hub-section">Application</h3>
      <p className="hub-note">Closing this window hides Soravo to the tray. Quit fully from here or the tray menu.</p>
      <div className="row">
        <button className="btn danger" onClick={onQuit}>
          Quit Soravo
        </button>
      </div>
    </div>
  )
}

export default function HubApp() {
  const [page, setPage] = useState<Page>('dictation')
  const [state, setState] = useState<RecState>('idle')
  const [lastText, setLastText] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<TranscriptEntry[]>([])
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
    return () => {
      offState()
      offText()
      offError()
    }
  }, [])

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
        <Sidebar page={page} go={setPage} />
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
          {page === 'settings' && (
            <SettingsPage settings={settings} onSave={saveSettings} onQuit={() => void window.soravo.quit()} />
          )}
        </main>
      </div>
    </div>
  )
}

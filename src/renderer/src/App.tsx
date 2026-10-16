import { useEffect, useRef, useState } from 'react'
import type { RecState, SoravoSettings, TranscriptEntry } from './soravo'
import { blobToWav16k } from './audio'

type View = 'pill' | 'history' | 'settings'

interface Recorder {
  mr: MediaRecorder
  chunks: Blob[]
  stream: MediaStream
  startedAt: number
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
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
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
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

export default function App() {
  const [state, setState] = useState<RecState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [lastText, setLastText] = useState('')
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('pill')
  const [history, setHistory] = useState<TranscriptEntry[]>([])
  const [settings, setSettings] = useState<SoravoSettings | null>(null)
  const [draftHotkey, setDraftHotkey] = useState('')
  const [draftModel, setDraftModel] = useState('')
  const [draftLanguage, setDraftLanguage] = useState('')
  const recRef = useRef<Recorder | null>(null)
  const timerRef = useRef<number | null>(null)

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      const startedAt = Date.now()
      recRef.current = { mr, chunks, stream, startedAt }
      mr.start(250)
      setElapsed(0)
      timerRef.current = window.setInterval(() => {
        setElapsed(Date.now() - (recRef.current?.startedAt ?? Date.now()))
      }, 250)
    } catch {
      setError('Microphone unavailable. Check Windows sound settings, then try again.')
      await window.soravo.submitAudio(new ArrayBuffer(0), 0)
    }
  }

  const stopRecorder = async () => {
    const rec = recRef.current
    recRef.current = null
    stopTimer()
    if (!rec) {
      await window.soravo.submitAudio(new ArrayBuffer(0), 0)
      return
    }
    const durationMs = Date.now() - rec.startedAt
    const blob = await new Promise<Blob>((resolve) => {
      rec.mr.onstop = () =>
        resolve(new Blob(rec.chunks, { type: rec.mr.mimeType || 'audio/webm' }))
      rec.mr.stop()
    })
    rec.stream.getTracks().forEach((t) => t.stop())
    try {
      const { buffer } = await blobToWav16k(blob)
      await window.soravo.submitAudio(buffer, durationMs)
    } catch {
      setError('Could not encode the recording.')
      await window.soravo.submitAudio(new ArrayBuffer(0), 0)
    }
  }

  useEffect(() => {
    window.soravo.getState().then(setState).catch(() => {})
    window.soravo.getSettings().then((s) => {
      setSettings(s)
      setDraftHotkey(s.hotkey)
      setDraftModel(s.model)
      setDraftLanguage(s.language)
    }).catch(() => {})
    const offState = window.soravo.onState(setState)
    const offCmd = window.soravo.onRecordCommand((cmd) => {
      if (cmd === 'start') void startRecorder()
      else void stopRecorder()
    })
    const offText = window.soravo.onTranscript((text) => {
      setLastText(text)
      setError('')
    })
    const offError = window.soravo.onError(setError)
    return () => {
      offState()
      offCmd()
      offText()
      offError()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void window.soravo.setHeight(view === 'pill' ? 84 : 430).catch(() => {})
    if (view === 'history') {
      window.soravo.getHistory(50).then(setHistory).catch(() => {})
    }
  }, [view ])

  const refreshHistory = () => {
    window.soravo.getHistory(50).then(setHistory).catch(() => {})
  }

  const saveSettings = async () => {
    const updated = await window.soravo.setSettings({
      hotkey: draftHotkey.trim() || 'CommandOrControl+Alt+Space',
      model: draftModel.trim() || 'base.en',
      language: draftLanguage.trim() || 'en'
    })
    setSettings(updated)
    setView('pill')
  }

  const subtitle = () => {
    if (state === 'recording')
      return (
        <span>
          <span className="rec-dot" />
          Recording {formatElapsed(elapsed)} — press hotkey to finish
        </span>
      )
    if (state === 'transcribing')
      return (
        <span>
          <span className="spinner" />
          Transcribing locally…
        </span>
      )
    if (state === 'error') return <span className="pill-sub error">{error || 'Something went wrong'}</span>
    if (error) return <span className="pill-sub error">{error}</span>
    if (lastText) return <span>{lastText}</span>
    return <span>Press {settings?.hotkey ?? '…'} to dictate</span>
  }

  return (
    <div>
      <div className="soravo-pill">
        <button
          className={state === 'recording' ? 'mic-btn recording' : 'mic-btn'}
          onClick={() => void window.soravo.toggle()}
          title="Toggle dictation"
        >
          {state === 'recording' ? <StopIcon /> : <MicIcon />}
        </button>
        <div className="pill-main">
          <div className="pill-title">Soravo</div>
          <div className="pill-sub">{subtitle()}</div>
        </div>
        <button
          className={view === 'history' ? 'icon-btn active' : 'icon-btn'}
          title="History"
          onClick={() => setView(view === 'history' ? 'pill' : 'history')}
        >
          <HistoryIcon />
        </button>
        <button
          className={view === 'settings' ? 'icon-btn active' : 'icon-btn'}
          title="Settings"
          onClick={() => setView(view === 'settings' ? 'pill' : 'settings')}
        >
          <SettingsIcon />
        </button>
        <button className="icon-btn" title="Quit Soravo" onClick={() => void window.soravo.quit()}>
          <CloseIcon />
        </button>
      </div>

      {view === 'history' && (
        <div className="soravo-drawer">
          <p className="drawer-title">Dictation history</p>
          {history.length === 0 && <p className="history-empty">Nothing dictated yet.</p>}
          {history.map((h) => (
            <div className="history-item" key={h.id}>
              <p className="history-text">{h.text}</p>
              <div className="history-meta">
                {new Date(h.createdAt).toLocaleString()}
                {h.durationMs !== null ? ` · ${(h.durationMs / 1000).toFixed(1)}s audio` : ''}
              </div>
            </div>
          ))}
          {history.length > 0 && (
            <div className="row">
              <button
                className="btn danger"
                onClick={() => void window.soravo.clearHistory().then(refreshHistory)}
              >
                Clear history
              </button>
              <button className="btn" onClick={refreshHistory}>
                Refresh
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'settings' && (
        <div className="soravo-drawer">
          <p className="drawer-title">Settings</p>
          <div className="row">
            <label>Hotkey</label>
            <input value={draftHotkey} onChange={(e) => setDraftHotkey(e.target.value)} spellCheck={false} />
          </div>
          <div className="row">
            <label>Model</label>
            <select value={draftModel} onChange={(e) => setDraftModel(e.target.value)}>
              <option value="base.en">base.en (fast, ~150MB)</option>
              <option value="small.en">small.en (better, ~500MB)</option>
            </select>
          </div>
          <div className="row">
            <label>Language</label>
            <input value={draftLanguage} onChange={(e) => setDraftLanguage(e.target.value)} spellCheck={false} />
          </div>
          <div className="row">
            <button className="btn primary" onClick={() => void saveSettings()}>
              Save
            </button>
            <button className="btn" onClick={() => setView('pill')}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { RecState } from './soravo'
import { blobToWav16k } from './audio'

interface Recorder {
  mr: MediaRecorder
  chunks: Blob[]
  stream: MediaStream
  startedAt: number
}

function fmtHotkey(accelerator: string): string {
  return accelerator.replace(/CommandOrControl/gi, 'Ctrl').split('+').join(' + ')
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
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

export default function App() {
  const [state, setState] = useState<RecState>('idle')
  const [hotkey, setHotkey] = useState('')
  const recRef = useRef<Recorder | null>(null)

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
      recRef.current = { mr, chunks, stream, startedAt: Date.now() }
      mr.start(250)
    } catch {
      await window.soravo.submitAudio(new ArrayBuffer(0), 0)
    }
  }

  const stopRecorder = async (submit: boolean) => {
    const rec = recRef.current
    recRef.current = null
    if (!rec) {
      if (submit) await window.soravo.submitAudio(new ArrayBuffer(0), 0)
      return
    }
    const durationMs = Date.now() - rec.startedAt
    const blob = await new Promise<Blob>((resolve) => {
      rec.mr.onstop = () =>
        resolve(new Blob(rec.chunks, { type: rec.mr.mimeType || 'audio/webm' }))
      rec.mr.stop()
    })
    rec.stream.getTracks().forEach((t) => t.stop())
    if (!submit) return
    try {
      const { buffer } = await blobToWav16k(blob)
      await window.soravo.submitAudio(buffer, durationMs)
    } catch {
      await window.soravo.submitAudio(new ArrayBuffer(0), 0)
    }
  }

  useEffect(() => {
    window.soravo.getState().then(setState).catch(() => {})
    window.soravo.getSettings().then((s) => setHotkey(fmtHotkey(s.hotkey))).catch(() => {})
    const offState = window.soravo.onState(setState)
    const offCmd = window.soravo.onRecordCommand((cmd) => {
      if (cmd === 'start') void startRecorder()
      else if (cmd === 'stop') void stopRecorder(true)
      else void stopRecorder(false)
    })
    return () => {
      offState()
      offCmd()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="soravo-mini">
      <button className="mini-x" title="Cancel" onClick={() => void window.soravo.cancel()}>
        <XIcon />
      </button>
      <div className="mini-status">
        {state === 'recording' && (
          <span className="live-dots" title="Recording">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
        {state === 'transcribing' && <span className="mini-spinner" title="Transcribing" />}
        {state === 'error' && <span className="mini-errdot" title="Error" />}
        {state === 'idle' && <span className="mini-hint">{hotkey ? `Press ${hotkey}` : 'Soravo'}</span>}
      </div>
      {state === 'idle' ? (
        <button className="mini-ok" title="Dictate" onClick={() => void window.soravo.toggle()}>
          <MicIcon />
        </button>
      ) : (
        <button
          className="mini-ok"
          title="Finish"
          disabled={state !== 'recording'}
          onClick={() => void window.soravo.toggle()}
        >
          <CheckIcon />
        </button>
      )}
    </div>
  )
}

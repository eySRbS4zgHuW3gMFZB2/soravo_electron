import { useEffect, useRef, useState } from 'react'
import type { RecState } from './soravo'
import { blobToWav16k } from './audio'
import { playBlip } from './sounds'
import { CheckIcon, CloseIcon } from '@/components/icons'
import { createWaveform, type WaveformController } from './waveform'
import './pill.css'

interface Recorder {
  mr: MediaRecorder
  chunks: Blob[]
  stream: MediaStream
  startedAt: number
}

async function soundsEnabled(): Promise<boolean> {
  try {
    const s = await window.soravo.getSettings()
    return s.sounds
  } catch {
    return true
  }
}

async function openMic(microphoneId: string): Promise<MediaStream> {
  const base = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  if (!microphoneId) {
    return navigator.mediaDevices.getUserMedia({ audio: base })
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { ...base, deviceId: { exact: microphoneId } },
    })
  } catch {
    // Selected device vanished (unplugged); fall back to auto-detect.
    return navigator.mediaDevices.getUserMedia({ audio: base })
  }
}

export default function App() {
  const [state, setState] = useState<RecState>('idle')
  const [handsFree, setHandsFree] = useState(false)
  const [hover, setHover] = useState<'cross' | 'tick' | null>(null)
  const recRef = useRef<Recorder | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const waveRef = useRef<WaveformController | null>(null)
  const rafRef = useRef(0)
  const sessionRef = useRef(0)

  const startRecorder = async () => {
    playBlip('start', await soundsEnabled())
    let microphoneId = ''
    try {
      microphoneId = (await window.soravo.getSettings()).microphoneId
    } catch {
      microphoneId = ''
    }
    try {
      const stream = await openMic(microphoneId)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : ''
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recRef.current = { mr, chunks, stream, startedAt: Date.now() }

      // Attach the waveform to the SAME stream the recorder uses.
      if (canvasRef.current) {
        const wave = createWaveform(canvasRef.current)
        waveRef.current = wave
        wave.start(stream)
      }
      mr.start(250)
      window.soravo.getState().catch(() => {})
    } catch {
      playBlip('error', await soundsEnabled())
      await window.soravo.notifyError('Could not open the microphone').catch(() => {})
    }
  }

  const stopWaveform = () => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    waveRef.current?.stop()
    waveRef.current = null
  }

  const stopRecorder = async (submit: boolean) => {
    stopWaveform()
    const rec = recRef.current
    recRef.current = null
    if (!rec) {
      // Nothing was captured (e.g. cancel before the mic opened). Discard.
      if (submit) await window.soravo.notifyError('Recording produced no audio').catch(() => {})
      return
    }
    playBlip('stop', await soundsEnabled())
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
      playBlip('success', await soundsEnabled())
    } catch {
      playBlip('error', await soundsEnabled())
      await window.soravo.notifyError('Could not decode the recording').catch(() => {})
    }
  }

  // Draw loop for the waveform canvas. Runs only while a recorder is live.
  useEffect(() => {
    if (state !== 'recording') return
    const tick = () => {
      waveRef.current?.draw()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => {
    window.soravo.getState().then(setState).catch(() => {})
    window.soravo
      .getHandsFree()
      .then((s) => {
        sessionRef.current = s.id
        setHandsFree(s.handsFree)
      })
      .catch(() => {})
    const offState = window.soravo.onState((s) => {
      setState(s)
      if (s === 'error') void soundsEnabled().then((on) => playBlip('error', on))
    })
    const offSession = window.soravo.onSession(({ id, handsFree }) => {
      sessionRef.current = id
      setHandsFree(handsFree)
    })
    const offCmd = window.soravo.onRecordCommand(({ command, session }) => {
      if (session !== sessionRef.current) return // stale event from an older session
      if (command === 'start') void startRecorder()
      else if (command === 'stop') void stopRecorder(true)
      else void stopRecorder(false)
    })
    return () => {
      offState()
      offSession()
      offCmd()
      stopWaveform()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clear the hover whenever the controls are not on screen. `onMouseLeave`
  // never fires when the buttons unmount (the cursor may still be over where
  // they were), which left the "Cancel"/"Finish and paste" tooltip stuck up
  // with no buttons rendered.
  useEffect(() => {
    if (!(state === 'recording' && handsFree)) setHover(null)
  }, [state, handsFree])

  const mode =
    state === 'idle'
      ? 'idle'
      : state === 'error'
        ? 'error'
        : state === 'transcribing'
          ? 'processing'
          : handsFree
            ? 'handsfree'
            : 'ptt'

  if (state === 'idle') return null

  return (
    <div className="pill-root">
      <div className="capsule-wrap">
        {(hover === 'cross' || hover === 'tick') && (
          <div className="pill-tooltip" role="status">
            {hover === 'cross' ? 'Cancel' : 'Finish and paste'}
          </div>
        )}
        <div className="capsule" data-mode={mode}>
          {state === 'recording' && (
            <>
              {handsFree && (
                <button
                  type="button"
                  className="pill-btn pill-cross"
                  aria-label="Cancel recording"
                  onMouseEnter={() => setHover('cross')}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => void window.soravo.cancel()}
                >
                  <CloseIcon />
                </button>
              )}
              <canvas ref={canvasRef} className="pill-wave" aria-hidden="true" />
              {handsFree && (
                <button
                  type="button"
                  className="pill-btn pill-tick"
                  aria-label="Finish and paste"
                  onMouseEnter={() => setHover('tick')}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => void window.soravo.finishRecording()}
                >
                  <CheckIcon />
                </button>
              )}
            </>
          )}
          {state === 'transcribing' && (
            <>
              <span className="pill-dots" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </span>
              <span className="pill-spinner" aria-label="Transcribing" role="status" />
            </>
          )}
          {state === 'error' && <span className="pill-err" role="alert" aria-label="Something went wrong" />}
        </div>
      </div>
    </div>
  )
}

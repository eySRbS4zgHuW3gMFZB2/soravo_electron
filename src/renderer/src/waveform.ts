//! Microphone-driven bar levels for the pill's waveform.
//!
//! Pure functions are kept separate from the canvas/AudioContext plumbing so
//! the level math is unit-testable without a device. Everything here is
//! deterministic: given the same sample buffer, the same levels come out.

export const BAR_COUNT = 12
export const MIN_LEVEL = 0.055
export const ATTACK = 0.5
export const DECAY = 0.12

/** Segment `count` windows of `samples` and return a 0..1 level per segment.
 *
 * The level blends RMS with a peak term so plosives are visible while quiet
 * fricatives stay alive. A mild power curve keeps mid-levels legible. The
 * result is clamped to [MIN_LEVEL, 1].
 */
export function segmentLevels(samples: Float32Array<ArrayBufferLike>, count: number, gain = 2.4): number[] {
  const out = new Array<number>(count).fill(MIN_LEVEL)
  if (samples.length === 0) return out
  const step = samples.length / count
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * step)
    const end = Math.max(start + 1, Math.floor((i + 1) * step))
    let sum = 0
    let peak = 0
    for (let j = start; j < end; j++) {
      const v = Math.abs(samples[j])
      sum += v * v
      if (v > peak) peak = v
    }
    const rms = Math.sqrt(sum / (end - start))
    const blended = Math.min(1, (rms * 0.65 + peak * 0.35) * gain)
    const shaped = Math.pow(blended, 0.72)
    out[i] = Math.max(MIN_LEVEL, Math.min(1, shaped))
  }
  return out
}

/** Smooth `next` toward the running `prev` levels with a fast attack and a
 * slow decay — the movement reads as speech energy rather than jitter. */
export function smoothLevels(prev: number[], next: number[], attack = ATTACK, decay = DECAY): number[] {
  const out = new Array<number>(next.length)
  for (let i = 0; i < next.length; i++) {
    const p = prev[i] ?? MIN_LEVEL
    const n = next[i]
    const rate = n >= p ? attack : decay
    out[i] = p + (n - p) * rate
  }
  return out
}

export interface WaveformController {
  start(stream: MediaStream): void
  stop(): void
  /** Render one frame. Driven by the component's rAF loop. */
  draw(): void
}

/** Create a controller bound to the given canvas. Owns an AudioContext that
 * taps the SAME MediaStream the recorder uses — no second microphone stream.
 */
export function createWaveform(canvas: HTMLCanvasElement): WaveformController {
  let audio: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let levels = new Array<number>(BAR_COUNT).fill(MIN_LEVEL)
  let buffer: Float32Array<ArrayBuffer> | null = null
  const ctx2d = canvas.getContext('2d')

  const draw = () => {
    if (!ctx2d) return
    if (analyser && buffer) {
      analyser.getFloatTimeDomainData(buffer)
      levels = smoothLevels(levels, segmentLevels(buffer, BAR_COUNT))
    } else {
      levels = smoothLevels(levels, new Array<number>(BAR_COUNT).fill(MIN_LEVEL))
    }
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr)
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr)
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx2d.clearRect(0, 0, w, h)
    const pitch = w / BAR_COUNT
    const barW = Math.max(1.4, Math.min(3.2, pitch * 0.55))
    ctx2d.fillStyle = '#f2f2ec'
    for (let i = 0; i < BAR_COUNT; i++) {
      const level = levels[i]
      const bh = Math.max(2.4, level * h)
      const x = i * pitch + (pitch - barW) / 2
      const y = (h - bh) / 2
      const r = barW / 2
      ctx2d.beginPath()
      ctx2d.roundRect(x, y, barW, bh, r)
      ctx2d.fill()
    }
  }

  return {
    start(stream: MediaStream) {
      this.stop()
      const Ctor: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext
      if (!Ctor) return // canvas still draws the floor via the rAF loop
      audio = new Ctor()
      analyser = audio.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.45
      source = audio.createMediaStreamSource(stream)
      source.connect(analyser)
      buffer = new Float32Array(analyser.fftSize)
      levels = new Array<number>(BAR_COUNT).fill(MIN_LEVEL)
    },
    stop() {
      try {
        source?.disconnect()
        analyser?.disconnect()
        void audio?.close()
      } catch {
        // ignore — the context may already be closed
      }
      audio = null
      analyser = null
      source = null
      buffer = null
      levels = new Array<number>(BAR_COUNT).fill(MIN_LEVEL)
    },
    draw,
  }
}

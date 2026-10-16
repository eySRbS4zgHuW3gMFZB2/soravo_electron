/**
 * Tiny WebAudio feedback blips (start/stop/success/error). No audio assets,
 * no network. Best-effort: if the AudioContext is blocked, calls stay silent.
 */

export type BlipKind = 'start' | 'stop' | 'success' | 'error'

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new Ctor()
    }
    void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

function tone(
  ac: AudioContext,
  frequency: number,
  durationMs: number,
  delayMs = 0,
  type: OscillatorType = 'sine'
): void {
  const startedAt = ac.currentTime + delayMs / 1000
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, startedAt)
  gain.gain.exponentialRampToValueAtTime(0.12, startedAt + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + durationMs / 1000)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(startedAt)
  osc.stop(startedAt + durationMs / 1000 + 0.05)
}

export function playBlip(kind: BlipKind, enabled: boolean): void {
  if (!enabled) return
  const ac = context()
  if (!ac) return
  try {
    if (kind === 'start') tone(ac, 880, 90)
    else if (kind === 'stop') tone(ac, 660, 90)
    else if (kind === 'success') {
      tone(ac, 880, 80)
      tone(ac, 1320, 120, 90)
    } else {
      tone(ac, 220, 160, 0, 'square')
    }
  } catch {
    // Stay silent on any audio failure.
  }
}

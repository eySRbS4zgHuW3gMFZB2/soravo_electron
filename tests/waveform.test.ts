import { describe, expect, it } from 'vitest'
import { BAR_COUNT, MIN_LEVEL, frequencyLevels, segmentLevels, smoothLevels } from '../src/renderer/src/waveform'

function sineSamples(freqHz: number, seconds: number, sampleRate = 16000, amplitude = 0.6): Float32Array<ArrayBuffer> {
  const n = Math.floor(seconds * sampleRate)
  const out = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate)
  }
  return out as Float32Array<ArrayBuffer>
}

describe('segmentLevels', () => {
  it('returns BAR_COUNT levels, all within [MIN_LEVEL, 1]', () => {
    const levels = segmentLevels(sineSamples(440, 0.5), BAR_COUNT)
    expect(levels).toHaveLength(BAR_COUNT)
    for (const v of levels) {
      expect(v).toBeGreaterThanOrEqual(MIN_LEVEL)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('silence stays at the floor', () => {
    const levels = segmentLevels(new Float32Array(1024) as Float32Array<ArrayBuffer>, BAR_COUNT)
    for (const v of levels) expect(v).toBe(MIN_LEVEL)
  })

  it('produces distinct bar heights when amplitude varies across the frame', () => {
    const n = 1024
    const samples = new Float32Array(new ArrayBuffer(n * 4))
    for (let i = 0; i < n; i++) {
      const ramp = 0.1 + (0.8 * i) / n
      samples[i] = ramp * Math.sin((2 * Math.PI * 220 * i) / 16000)
    }
    const levels = segmentLevels(samples as Float32Array<ArrayBuffer>, BAR_COUNT)
    const rising = levels.every((v, i) => i === 0 || v >= levels[i - 1] - 1e-9)
    expect(rising).toBe(true)
    expect(levels[BAR_COUNT - 1]).toBeGreaterThan(levels[0])
  })

  it('loud signals produce higher levels than quiet signals', () => {
    const quiet = segmentLevels(sineSamples(440, 0.3, 16000, 0.05), BAR_COUNT)
    const loud = segmentLevels(sineSamples(440, 0.3, 16000, 0.9), BAR_COUNT)
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
    expect(sum(loud)).toBeGreaterThan(sum(quiet))
  })
})

describe('frequencyLevels', () => {
  // Build an FFT-bin-like buffer where the value at bin j expresses dB
  // level of frequency bin j (range roughly -100..0). This mirrors what
  // AudioContext.analyser.getFloatFrequencyData produces.
  function toneFreqData(fftSize: number, freqHz: number, sampleRate: number, amplitude: number): Float32Array<ArrayBuffer> {
    // Synthesise a single sharp peak in frequency space to model a tone.
    const bins = fftSize / 2
    const out = new Float32Array(new ArrayBuffer(bins * 4))
    for (let i = 0; i < bins; i++) out[i] = -100
    const binFreq = sampleRate / fftSize
    const peakBin = Math.max(1, Math.min(bins - 1, Math.round(freqHz / binFreq)))
    const peakDb = amplitude > 0 ? 20 * Math.log10(amplitude) : -100
    out[peakBin] = Math.max(-100, Math.min(0, peakDb))
    // Spill a little energy into adjacent bins to model real analyser spread.
    if (peakBin > 0) out[peakBin - 1] = Math.max(-100, peakDb - 18)
    if (peakBin < bins - 1) out[peakBin + 1] = Math.max(-100, peakDb - 18)
    return out as Float32Array<ArrayBuffer>
  }

  function silenceFreqData(fftSize: number): Float32Array<ArrayBuffer> {
    const bins = fftSize / 2
    const out = new Float32Array(new ArrayBuffer(bins * 4))
    for (let i = 0; i < bins; i++) out[i] = -100
    return out as Float32Array<ArrayBuffer>
  }

  it('returns BAR_COUNT levels, all within [MIN_LEVEL, 1]', () => {
    const data = toneFreqData(2048, 440, 44100, 0.6)
    const levels = frequencyLevels(data, BAR_COUNT, -100, 0, 1)
    expect(levels).toHaveLength(BAR_COUNT)
    for (const v of levels) {
      expect(v).toBeGreaterThanOrEqual(MIN_LEVEL)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('silence stays at the floor', () => {
    const data = silenceFreqData(2048)
    const levels = frequencyLevels(data, BAR_COUNT, -100, 0, 1)
    for (const v of levels) expect(v).toBe(MIN_LEVEL)
  })

  it('bars do not all receive identical values for a tonal input', () => {
    const data = toneFreqData(2048, 440, 44100, 0.6)
    const levels = frequencyLevels(data, BAR_COUNT, -100, 0, 1)
    const distinct = new Set(levels.map((v) => v.toFixed(4))).size
    expect(distinct).toBeGreaterThan(1)
  })

  it('a low tone and a high tone produce different bar-height patterns', () => {
    const low = frequencyLevels(toneFreqData(2048, 250, 44100, 0.6), BAR_COUNT, -100, 0, 1)
    const high = frequencyLevels(toneFreqData(2048, 4000, 44100, 0.6), BAR_COUNT, -100, 0, 1)
    // At least some bars differ meaningfully
    let diffCount = 0
    for (let i = 0; i < BAR_COUNT; i++) {
      if (Math.abs(low[i] - high[i]) > 0.05) diffCount++
    }
    expect(diffCount).toBeGreaterThan(0)
  })

  it('loud signals produce higher levels than quiet signals', () => {
    const quiet = frequencyLevels(toneFreqData(2048, 440, 44100, 0.05), BAR_COUNT, -100, 0, 1)
    const loud = frequencyLevels(toneFreqData(2048, 440, 44100, 0.9), BAR_COUNT, -100, 0, 1)
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
    expect(sum(loud)).toBeGreaterThan(sum(quiet))
  })

  it('different frequencies shift which bar is the peak', () => {
    const lo = frequencyLevels(toneFreqData(2048, 300, 44100, 0.6), BAR_COUNT, -100, 0, 1)
    const hi = frequencyLevels(toneFreqData(2048, 8000, 44100, 0.6), BAR_COUNT, -100, 0, 1)
    const peakIndex = (levels: number[]) => levels.reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0)
    expect(peakIndex(lo)).toBeLessThan(peakIndex(hi))
  })

  it('empty/zero-bin buffer stays at the floor', () => {
    const empty = new Float32Array(0) as Float32Array<ArrayBuffer>
    const levels = frequencyLevels(empty, BAR_COUNT, -100, 0, 1)
    for (const v of levels) expect(v).toBe(MIN_LEVEL)
  })
})

describe('smoothLevels', () => {
  it('rises fast and falls slowly', () => {
    const from = new Array<number>(BAR_COUNT).fill(MIN_LEVEL)
    const to = new Array<number>(BAR_COUNT).fill(1)
    const risen = smoothLevels(from, to)
    for (const v of risen) expect(v).toBeGreaterThan(MIN_LEVEL + 0.2)

    const back = smoothLevels(to, from)
    for (const v of back) expect(v).toBeGreaterThan(from[0])
    for (const v of back) expect(v).toBeLessThan(1)
  })

  it('is idempotent at equilibrium', () => {
    const level = new Array<number>(BAR_COUNT).fill(0.5)
    expect(smoothLevels(level, level)).toEqual(level)
  })
})

describe('frequencyLevels vs segmentLevels coherence', () => {
  it('a single frequency energy column does not produce identical bars', () => {
    // Sanity: the whole point of the fix is that bars differ.
    const data = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) data[i] = -100
    data[500] = 0 // strong tone in one bin only
    const levels = frequencyLevels(data, BAR_COUNT, -100, 0, 1)
    const set = new Set(levels.map((v) => v.toFixed(3)))
    expect(set.size).toBeGreaterThan(1)
  })
})

describe('frequencyLevels realistic speech', () => {
  function speechFreqData(fftSize: number, peakDb: number): Float32Array<ArrayBuffer> {
    const bins = fftSize / 2
    const out = new Float32Array(new ArrayBuffer(bins * 4))
    // Speech-like spectrum: energy clustered across mid-low and mid bands,
    // tailing off toward higher bands. Plus a modest noise floor at -92 dB.
    for (let i = 0; i < bins; i++) {
      const band = i / (bins - 1)
      const tilt = 1 - band * 0.7
      out[i] = -92 + tilt * ((peakDb + 92) * 0.4)
    }
    return out as Float32Array<ArrayBuffer>
  }

  it('normal conversational source level (-35 dB-ish active bins) produces clearly visible bars', () => {
    const data = speechFreqData(2048, -30)
    const levels = frequencyLevels(data, BAR_COUNT)
    const avg = levels.reduce((a, b) => a + b, 0) / BAR_COUNT
    // Avg should exceed MIN_LEVEL by a clear margin (visible centred motion).
    expect(avg).toBeGreaterThan(MIN_LEVEL + 0.15)
  })

  it('quiet source gives restrained, non-zero bars', () => {
    const data = speechFreqData(2048, -55)
    const levels = frequencyLevels(data, BAR_COUNT)
    const avg = levels.reduce((a, b) => a + b, 0) / BAR_COUNT
    expect(avg).toBeGreaterThan(MIN_LEVEL)
    expect(avg).toBeLessThan(0.7)
  })

  it('loud source gives significantly taller bars', () => {
    const normal = speechFreqData(2048, -30)
    const loud = speechFreqData(2048, -15)
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
    expect(sum(loud)).toBeGreaterThan(sum(normal) * 1.3)
  })

  it('silence keeps every bar at the floor (no jitter)', () => {
    const data = new Float32Array(new ArrayBuffer((2048 / 2) * 4))
    for (let i = 0; i < data.length; i++) data[i] = -100
    const levels = frequencyLevels(data as Float32Array<ArrayBuffer>, BAR_COUNT)
    for (const v of levels) expect(v).toBe(MIN_LEVEL)
  })

  it('per-bar levels are not all identical', () => {
    const data = speechFreqData(2048, -30)
    const levels = frequencyLevels(data, BAR_COUNT)
    const distinct = new Set(levels.map((v) => v.toFixed(3))).size
    expect(distinct).toBeGreaterThan(2)
  })
})

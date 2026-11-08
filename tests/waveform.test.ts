import { describe, expect, it } from 'vitest'
import { BAR_COUNT, MIN_LEVEL, segmentLevels, smoothLevels } from '../src/renderer/src/waveform'

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
    // A linear amplitude ramp — the segments see increasing energy.
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

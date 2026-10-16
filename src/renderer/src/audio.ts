/**
 * Decode any browser-decodable audio blob and re-encode it as 16 kHz
 * mono 16-bit PCM WAV — the exact input whisper.cpp expects.
 */
export async function blobToWav16k(blob: Blob): Promise<{ buffer: ArrayBuffer; durationMs: number }> {
  const raw = await blob.arrayBuffer()
  const Ctor: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctor()
  try {
    const decoded = await ctx.decodeAudioData(raw)
    const durationMs = decoded.duration * 1000
    const mono = mixToMono(decoded)
    const resampled = await resample(mono, decoded.sampleRate, 16000)
    return { buffer: encodeWavPcm16(resampled, 16000), durationMs }
  } finally {
    await ctx.close().catch(() => {})
  }
}

function mixToMono(decoded: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = decoded
  if (numberOfChannels === 1) return decoded.getChannelData(0).slice()
  const out = new Float32Array(length)
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = decoded.getChannelData(ch)
    for (let i = 0; i < length; i++) out[i] += data[i] / numberOfChannels
  }
  return out
}

async function resample(input: Float32Array, fromRate: number, toRate: number): Promise<Float32Array> {
  if (fromRate === toRate) return input
  const length = Math.max(1, Math.ceil((input.length * toRate) / fromRate))
  const offline = new OfflineAudioContext(1, length, toRate)
  const source = offline.createBufferSource()
  const buffer = offline.createBuffer(1, input.length, fromRate)
  buffer.getChannelData(0).set(input)
  source.buffer = buffer
  source.connect(offline.destination)
  source.start(0)
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0).slice()
}

function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  }
  return buffer
}

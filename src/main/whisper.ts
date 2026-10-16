import { execFile } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { app } from 'electron'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

function thirdPartyDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'third-party')
    : join(app.getAppPath(), 'third-party')
}

function findBinary(dir: string): string | null {
  for (const name of ['whisper-cli.exe', 'whisper-cli', 'main.exe', 'main']) {
    const p = join(dir, 'bin', name)
    if (existsSync(p)) return p
  }
  return null
}

export function modelPath(model: string): string {
  return join(thirdPartyDir(), 'models', `ggml-${model}.bin`)
}

export interface RuntimeStatus {
  binary: boolean
  model: string
  modelPresent: boolean
}

export function runtimeStatus(model: string): RuntimeStatus {
  let binary = false
  try {
    requireWhisperBinary()
    binary = true
  } catch {
    binary = false
  }
  return { binary, model, modelPresent: existsSync(modelPath(model)) }
}

/** Absolute whisper binary path, or an Error explaining how to fetch it. */
export function requireWhisperBinary(): string {
  const bin = findBinary(thirdPartyDir())
  if (!bin) {
    throw new Error(
      'whisper.cpp binary missing. Run `npm run fetch:whisper` from the Soravo project, ' +
        'then restart the app.'
    )
  }
  return bin
}

/**
 * Transcribe a 16 kHz mono PCM WAV file with local whisper.cpp.
 * Returns the trimmed transcript text. Cleans up whisper's sidecar files.
 */
export async function transcribeWav(
  wavPath: string,
  model: string,
  language: string
): Promise<string> {
  const binary = requireWhisperBinary()
  const modelFile = modelPath(model)
  if (!existsSync(modelFile)) {
    throw new Error(
      `Whisper model "${model}" missing at ${modelFile}. Run \`npm run fetch:whisper\`, then restart.`
    )
  }
  const outBase = join(tmpdir(), `soravo-${randomUUID()}`)
  try {
    await execFileAsync(
      binary,
      ['-m', modelFile, '-f', wavPath, '-l', language, '--output-txt', '-of', outBase, '-t', '4'],
      { timeout: 300000, windowsHide: true }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Transcription failed: ${message}`)
  }
  const txtPath = `${outBase}.txt`
  try {
    return readFileSync(txtPath, 'utf8').replace(/\[.*?\]|\s+/g, ' ').trim()
  } finally {
    await unlink(txtPath).catch(() => {})
  }
}

export async function writeTempWav(data: ArrayBuffer): Promise<string> {
  const p = join(tmpdir(), `soravo-${randomUUID()}.wav`)
  await writeFile(p, Buffer.from(data))
  return p
}

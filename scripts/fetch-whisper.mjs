/**
 * One-time fetcher for Soravo's local transcription runtime.
 * Downloads the whisper.cpp Windows x64 binary and the base English model
 * into third-party/ (git-ignored). Re-run to repair either artifact.
 *
 * Usage: npm run fetch:whisper
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const binDir = join(root, 'third-party', 'bin')
const modelsDir = join(root, 'third-party', 'models')
const MODEL_FILE = 'ggml-base.en.bin'
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_FILE}`

async function download(url, dest) {
  mkdirSync(dirname(dest), { recursive: true })
  const res = await fetch(url, { headers: { 'User-Agent': 'soravo-setup' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const { writeFileSync } = await import('fs')
  writeFileSync(dest, buf)
  return buf.length
}

function pickBinaryAsset(assets) {
  const zips = assets.filter((a) => a.name.endsWith('.zip'))
  // Plain CPU Windows x64 build: smallest, no GPU/driver dependencies.
  const plain = zips.find((a) => a.name === 'whisper-bin-x64.zip')
  if (plain) return plain
  return (
    zips.find(
      (a) => /x64/i.test(a.name) && !/cuda|cublas|blas|arm64|win32|source|src/i.test(a.name)
    ) ?? null
  )
}

const WHISPER_BINARIES = ['whisper-cli.exe', 'main.exe']

function listFilesRecursive(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) listFilesRecursive(full, out)
    else out.push(full)
  }
  return out
}

function baseName(p) {
  return p.split(/[\\/]/).pop()
}

/** Archives sometimes nest the binary; hoist whisper-cli (plus sibling DLLs) to the bin root. */
function relocateWhisperBinary(binDir) {
  const all = listFilesRecursive(binDir)
  const cli =
    all.find((f) => baseName(f) === 'whisper-cli.exe') ??
    all.find((f) => baseName(f) === 'main.exe')
  if (!cli) {
    throw new Error(
      `Extracted archive but found no whisper binary in ${binDir}. Inspect it manually.`
    )
  }
  if (dirname(cli) !== binDir) {
    // Move the binary plus any DLLs living next to it (native deps must sit beside the exe).
    renameSync(cli, join(binDir, baseName(cli)))
    for (const f of listFilesRecursive(dirname(cli))) {
      if (f.endsWith('.dll')) renameSync(f, join(binDir, baseName(f)))
    }
  }
  console.log(`Whisper binary ready: ${join(binDir, baseName(cli))}`)
}

async function findBinaryRelease() {
  // Versioned releases (vX.Y.Z) carry no binaries; bless the newest
  // build-tagged (bNNNN) release that ships a Windows x64 zip.
  const releases = await (
    await fetch('https://api.github.com/repos/ggerganov/whisper.cpp/releases?per_page=10', {
      headers: { 'User-Agent': 'soravo-setup' }
    })
  ).json()
  for (const rel of releases) {
    if (!rel.tag_name.startsWith('b') || !Array.isArray(rel.assets)) continue
    const asset = pickBinaryAsset(rel.assets)
    if (asset) return { rel, asset }
  }
  const tags = releases.map((r) => r.tag_name).join(', ')
  throw new Error(`No Windows x64 binary found in recent releases (${tags}).`)
}

async function main() {
  mkdirSync(binDir, { recursive: true })
  mkdirSync(modelsDir, { recursive: true })

  console.log('Resolving newest whisper.cpp build release…')
  const { rel, asset } = await findBinaryRelease()
  console.log(`Using ${rel.tag_name}: ${asset.name} (${(asset.size / 1048576).toFixed(1)} MB)…`)
  const zipPath = join(tmpdir(), 'soravo-whisper-bin.zip')
  await download(asset.browser_download_url, zipPath)
  console.log('Extracting…')
  rmSync(binDir, { recursive: true, force: true })
  mkdirSync(binDir, { recursive: true })
  execFileSync('tar.exe', ['-xf', zipPath, '-C', binDir], { stdio: 'inherit' })
  rmSync(zipPath, { force: true })
  relocateWhisperBinary(binDir)

  const modelDest = join(modelsDir, MODEL_FILE)
  if (existsSync(modelDest)) {
    console.log(`Model already present: ${modelDest}`)
  } else {
    console.log(`Downloading model ${MODEL_FILE} (~142 MB)…`)
    const bytes = await download(MODEL_URL, modelDest)
    console.log(`Model saved (${(bytes / 1048576).toFixed(1)} MB): ${modelDest}`)
  }
  console.log('Done. Restart Soravo to pick up the runtime.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})

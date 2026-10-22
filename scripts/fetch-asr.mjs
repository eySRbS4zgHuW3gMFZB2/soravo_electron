/**
 * One-time fetcher for Soravo's local transcription runtime.
 *
 * Downloads the CrispASR CPU build and one Whisper GGUF model into
 * third-party/ (git-ignored). Re-run to repair either artifact.
 *
 * Usage:
 *   npm run fetch:asr                          # Windows: downloads .zip to third-party/bin/
 *   npm run fetch:asr --platform linux         # Linux: downloads .tar.gz to third-party/crispasr/extracted/crispasr-linux-x86_64-cpu/
 *   npm run fetch:asr -- base.en               # default: tiny.en (~75 MB, fastest)
 *   npm run fetch:asr -- base.en --platform linux
 *
 * Model ids map to ggml-<id>.bin in third-party/models/. The active model is
 * chosen in Settings; it must match one of the files present here.
 */
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const binDir = join(root, 'third-party', 'bin')
const modelsDir = join(root, 'third-party', 'models')
const linuxEngineDir = join(
  root,
  'third-party',
  'crispasr',
  'extracted',
  'crispasr-linux-x86_64-cpu'
)

const CRISPASR_REPO = 'CrispStrobe/CrispASR'
const GGML_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

/** Model sizes are only used for the progress message. */
const MODEL_HINTS = {
  tiny: '~75 MB',
  'tiny.en': '~75 MB',
  base: '~142 MB',
  'base.en': '~142 MB',
  small: '~466 MB',
  'small.en': '~466 MB',
  medium: '~1.5 GB',
  'medium.en': '~1.5 GB'
}

const DEFAULT_MODEL = 'tiny.en'
const PLATFORM = process.argv.includes('--platform linux') ? 'linux' : 'windows'

function pickBinaryAsset(assets) {
  if (PLATFORM === 'linux') {
    // Plain CPU Linux x64 build: no GPU or driver dependency, works everywhere.
    const plain = assets.find((a) => a.name === 'crispasr-linux-x86_64.tar.gz')
    if (plain) return plain
    return (
      assets.find(
        (a) =>
          /linux.*x86_64/i.test(a.name) &&
          !/cuda|vulkan|cpu-legacy|non-cuda|arm64|hip|source|src/i.test(a.name)
      ) ?? null
    )
  }
  // Windows: plain CPU x64 build.
  const zips = assets.filter((a) => a.name.endsWith('.zip'))
  const plain = zips.find((a) => a.name === 'crispasr-windows-x86_64-cpu.zip')
  if (plain) return plain
  return (
    zips.find(
      (a) =>
        /windows.*x86_64/i.test(a.name) &&
        !/cuda|vulkan|cpu-legacy|non-cuda|arm64|win32|source|src/i.test(a.name)
    ) ?? null
  )
}

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

async function download(url, dest, label) {
  mkdirSync(dirname(dest), { recursive: true })
  const res = await fetch(url, { headers: { 'User-Agent': 'soravo-setup' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${label}: ${url}`)

  const total = Number(res.headers.get('content-length') ?? 0)
  if (!total || !res.body) {
    const buf = Buffer.from(await res.arrayBuffer())
    const { writeFileSync } = await import('fs')
    writeFileSync(dest, buf)
    return buf.length
  }

  // Stream so a 1.5 GB model does not have to sit in memory all at once.
  const { writeFileSync, createWriteStream } = await import('fs')
  const out = createWriteStream(dest)
  let received = 0
  let lastPct = -1
  try {
    for await (const chunk of res.body) {
      received += chunk.length
      out.write(chunk)
      const pct = Math.floor((received / total) * 100)
      if (pct >= lastPct + 10) {
        lastPct = pct
        console.log(`  ${label}: ${pct}% (${(received / 1048576).toFixed(1)} MB)`)
      }
    }
  } finally {
    await new Promise((resolve, reject) => out.end(resolve).on('error', reject))
  }
  return received
}

/** The Windows archive nests everything one level deep; hoist the exe and its DLLs. */
function relocateBinary(binDir) {
  const all = listFilesRecursive(binDir)
  const exe = all.find((f) => baseName(f) === 'crispasr.exe')
  if (!exe) {
    throw new Error(`Extracted archive but found no crispasr.exe in ${binDir}. Inspect it manually.`)
  }
  if (dirname(exe) !== binDir) {
    // Native dependencies must sit beside the exe to be found at load time.
    renameSync(exe, join(binDir, 'crispasr.exe'))
    const sourceDir = dirname(exe)
    for (const f of listFilesRecursive(sourceDir)) {
      if (f.endsWith('.dll')) renameSync(f, join(binDir, baseName(f)))
    }
  }
  console.log(`CrispASR binary ready: ${join(binDir, 'crispasr.exe')}`)
}

async function findLatestRelease() {
  const res = await fetch(`https://api.github.com/repos/${CRISPASR_REPO}/releases?per_page=10`, {
    headers: { 'User-Agent': 'soravo-setup' }
  })
  if (!res.ok) throw new Error(`Could not list ${CRISPASR_REPO} releases (${res.status})`)
  const releases = await res.json()
  for (const rel of releases) {
    if (rel.draft || !Array.isArray(rel.assets)) continue
    const asset = pickBinaryAsset(rel.assets)
    if (asset) return { rel, asset }
  }
  const tags = releases.map((r) => r.tag_name).join(', ')
  const platformLabel = PLATFORM === 'linux' ? 'Linux x64 CPU' : 'Windows x64 CPU'
  throw new Error(`No ${platformLabel} binary found in recent releases (${tags}).`)
}

function parseModelArg() {
  // `npm run fetch:asr -- base.en` and a bare `node fetch-asr.mjs base.en` should
  // both work, so accept the flag-free positional too.
  const dashIdx = process.argv.indexOf('--')
  const raw =
    dashIdx >= 0 ? process.argv[dashIdx + 1] : process.argv[2]
  const model = (raw ?? DEFAULT_MODEL).trim()
  if (!/^[a-z0-9._-]+$/i.test(model)) {
    throw new Error(`Invalid model id: ${model}`)
  }
  return model
}

async function main() {
  const model = parseModelArg()
  const modelFile = `ggml-${model}.bin`
  const modelDest = join(modelsDir, modelFile)

  mkdirSync(modelsDir, { recursive: true })

  // Binary first: a missing exe is the more confusing failure.
  if (PLATFORM === 'linux') {
    mkdirSync(linuxEngineDir, { recursive: true })
    const linuxExe = join(linuxEngineDir, 'crispasr')
    if (existsSync(linuxExe)) {
      console.log(`CrispASR binary already present: ${linuxExe}`)
    } else {
      console.log('Resolving newest CrispASR release…')
      const { rel, asset } = await findLatestRelease()
      console.log(`Using ${rel.tag_name}: ${asset.name} (${(asset.size / 1048576).toFixed(1)} MB)…`)
      const tarPath = join(tmpdir(), 'soravo-crispasr-linux.tar.gz')
      await download(asset.browser_download_url, tarPath, 'binary')
      console.log('Extracting…')
      rmSync(linuxEngineDir, { recursive: true, force: true })
      mkdirSync(linuxEngineDir, { recursive: true })
      execFileSync('tar', ['-xzf', tarPath, '-C', linuxEngineDir], {
        stdio: 'inherit'
      })
      rmSync(tarPath, { force: true })
      console.log(`CrispASR binary ready: ${linuxExe}`)
    }
  } else {
    mkdirSync(binDir, { recursive: true })
    if (existsSync(join(binDir, 'crispasr.exe'))) {
      console.log(`CrispASR binary already present: ${join(binDir, 'crispasr.exe')}`)
    } else {
      console.log('Resolving newest CrispASR release…')
      const { rel, asset } = await findLatestRelease()
      console.log(`Using ${rel.tag_name}: ${asset.name} (${(asset.size / 1048576).toFixed(1)} MB)…`)
      const zipPath = join(tmpdir(), 'soravo-crispasr-bin.zip')
      await download(asset.browser_download_url, zipPath, 'binary')
      console.log('Extracting…')
      rmSync(binDir, { recursive: true, force: true })
      mkdirSync(binDir, { recursive: true })
      execFileSync('tar.exe', ['-xf', zipPath, '-C', binDir], { stdio: 'inherit' })
      rmSync(zipPath, { force: true })
      relocateBinary(binDir)
    }
  }

  if (existsSync(modelDest)) {
    console.log(`Model already present: ${modelFile}`)
  } else {
    const hint = MODEL_HINTS[model] ?? 'unknown size'
    console.log(`Downloading model ${modelFile} (${hint})…`)
    await download(`${GGML_BASE}/${modelFile}`, modelDest, model)
    console.log(`Model saved: ${modelDest}`)
  }

  console.log(`\nDone. In Soravo Settings pick the "${model}" model to use it.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
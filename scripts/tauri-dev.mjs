import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
function viteCli(cwd) {
  try {
    const require = createRequire(path.join(cwd, 'package.json'))
    return path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js')
  } catch {
    return null
  }
}

const desktopCwd = root
const websiteCwd = path.join(root, 'website')
const services = [
  {
    name: 'Soravo desktop Vite',
    cwd: desktopCwd,
    vite: viteCli(desktopCwd),
    args: ['--strictPort'],
  },
  {
    name: 'Soravo website Vite',
    cwd: websiteCwd,
    vite: viteCli(websiteCwd),
    args: ['--host', '127.0.0.1', '--strictPort'],
    readyUrl: 'http://127.0.0.1:5174/auth/desktop',
  },
]

const missing = services.filter(({ vite }) => !vite || !existsSync(vite))
const websiteDependenciesMissing = !existsSync(path.join(websiteCwd, 'node_modules'))
if (websiteDependenciesMissing) missing.push(services[1])
if (missing.length > 0) {
  const websiteMissing = missing.some(({ cwd }) => cwd === path.join(root, 'website'))
  console.error(
    websiteMissing
      ? 'Website dependencies are missing. Run `npm ci --prefix website`, then restart `npm run tauri:dev`.'
      : 'Desktop dependencies are missing. Run `npm ci` from the repository root, then restart `npm run tauri:dev`.',
  )
  process.exit(1)
}

let stopping = false
let exitCode = 0
const children = []
const running = new Set()

function stop(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill(signal)
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForReady(service) {
  const deadline = Date.now() + 30_000
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(service.readyUrl, { signal: AbortSignal.timeout(500) })
      if (response.ok) return
    } catch {
      // The website can take a moment to load its Vite plugins and env file.
    }
    await delay(200)
  }
  if (!stopping) {
    console.error(`${service.name} did not become reachable at ${service.readyUrl} within 30 seconds.`)
    exitCode = 1
    stop()
  }
}

async function desktopDevServerAlreadyRunning() {
  try {
    const response = await fetch('http://localhost:5173/src/main.tsx', {
      signal: AbortSignal.timeout(500),
    })
    return response.ok
  } catch {
    return false
  }
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

for (const service of [...services].reverse()) {
  if (stopping) break
  if (service.name === 'Soravo desktop Vite' && await desktopDevServerAlreadyRunning()) {
    console.error('A Vite server already occupies port 5173. Close the other Soravo dev session, then start `npm run tauri:dev` from this checkout so the desktop and browser handoff use matching code.')
    exitCode = 1
    stop()
    break
  }
  console.log(`Starting ${service.name}...`)
  const child = spawn(process.execPath, [service.vite, ...service.args], {
    cwd: service.cwd,
    env: process.env,
    stdio: 'inherit',
  })
  children.push(child)
  running.add(child)
  child.on('error', (error) => {
    console.error(`Could not start ${service.name}: ${error.message}`)
    exitCode = 1
    stop()
  })
  child.on('close', (code, signal) => {
    running.delete(child)
    if (stopping) return
    console.error(`${service.name} stopped${signal ? ` after ${signal}` : ` with exit code ${code}`}.`)
    exitCode = code === 0 ? 1 : (code ?? 1)
    stop()
  })
  if (service.readyUrl) await waitForReady(service)
}

while (running.size > 0) {
  await new Promise((resolve) => setTimeout(resolve, 100))
}

process.exitCode = exitCode

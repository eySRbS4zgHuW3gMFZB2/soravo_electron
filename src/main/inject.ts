import { clipboard } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Inject text into the focused app via clipboard + Ctrl+V.
 * Preserves and restores previous text clipboard content.
 * Limitations: non-text clipboard payloads (images/files) are not preserved;
 * keystroke injection is refused by elevated windows (UAC integrity levels).
 */
export async function injectText(text: string): Promise<void> {
  const previous = clipboard.readText()
  clipboard.writeText(text)
  await delay(80)
  try {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$w = New-Object -ComObject WScript.Shell; $w.SendKeys('^v')"
    ])
  } finally {
    await delay(300)
    clipboard.writeText(previous)
  }
}

/**
 * Keeps the embedded webview from behaving like a web page.
 *
 * A Tauri window is an app, not a document: the webview's own context menu
 * ("Back / Forward / Refresh / Save as / Print / Inspect") and its built-in
 * browser shortcuts (Ctrl+F find-in-page, Ctrl+P print, Ctrl+S save the page,
 * F12 devtools, ...) do not belong here. Wispr Flow's hub has neither, and a
 * dictation app that can be searched with Ctrl+F or printed with Ctrl+P is
 * confusing.
 *
 * Everything here is a no-op for the app's own controls: the hotkey capture
 * fields keep their key handling, and text fields keep their editing
 * shortcuts.
 */

import { matchesHotkey } from './hotkeys'

/**
 * Chords the app itself uses.
 *
 * The guard below blocks the browser's own shortcuts, and several of them
 * collide with the app's hotkeys - Ctrl+1 is a browser tab shortcut, and it
 * is also the default dictation hotkey. Blocking it here would stop the
 * hotkey from ever reaching the app, so the app's own chords are excluded.
 */
let appChords: string[] = []

/** Tell the guard which chords belong to the app. */
export function setAppChords(chords: string[]): void {
  appChords = chords.filter(Boolean)
}

/** Browser-level chords that have no meaning in this app. */
const BLOCKED_CHORDS = new Set([
  // find in page, find next, find previous
  'f',
  'g',
  'h',
  // print, save page, open, view source, zoom
  'p',
  's',
  'o',
  'u',
  '=',
  '+',
  '-',
  '0',
  // devtools
  'i',
  'j',
  'c',
  // window and tab management
  'w',
  't',
  'n',
  'k',
  'l',
  'r',
  'e',
  'd'
])

/** Keys that are only a chord with a modifier. */
const MODIFIERED_ONLY = new Set(['f', 'g', 'h', 'p', 's', 'o', 'u', 'w', 't', 'n', 'i', 'j', 'c'])

/** Function keys that open browser UI. */
const BLOCKED_FUNCTION_KEYS = new Set(['F3', 'F10', 'F12'])

/**
 * True when the event is aimed at a control that is capturing a shortcut.
 * Those fields bind keys, so they must keep receiving them.
 */
function isHotkeyCapture(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.hotkey-field') !== null
}

/**
 * True when the event comes from somewhere the user is typing. Editing
 * shortcuts (cut, copy, paste, undo, select all) stay available there.
 */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

function shouldBlock(event: KeyboardEvent): boolean {
  if (isHotkeyCapture(event.target)) return false

  if (event.key === 'ContextMenu') return true

  if (BLOCKED_FUNCTION_KEYS.has(event.key)) return true

  if (!event.ctrlKey && !event.metaKey) return false

  // The app's own chords are never browser shortcuts.
  if (appChords.some((chord) => matchesHotkey(event, chord))) return false

  // Ctrl+Shift+<key> is a different chord from Ctrl+<key>.
  const chord = event.key.toLowerCase()

  if (event.altKey) return false

  if (event.shiftKey) {
    // Ctrl+Shift+I/J/C open devtools, Ctrl+Shift+S save-as, Ctrl+Shift+F
    // opens the browser's own search, Ctrl+Shift+W closes the window.
    return ['i', 'j', 'c', 's', 'f', 'w', 'n', 'p', 'g', 'h', 'o', 'u', 't'].includes(chord)
  }

  if (MODIFIERED_ONLY.has(chord)) return true

  // Ctrl+Tab / Ctrl+Shift+Tab switch tabs, Ctrl+1..9 focus a tab.
  if (chord === 'tab') return true
  if (/^[1-9]$/.test(chord)) return true

  // Remaining single-letter chords that only make sense in a browser.
  if (BLOCKED_CHORDS.has(chord) && !isTextEntry(event.target)) return true

  return false
}

/**
 * Installs the guards. Safe to call once per window; it returns a cleanup
 * function.
 */
export function installAppShortcuts(target: Document = document): () => void {
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!shouldBlock(event)) return
    event.preventDefault()
    event.stopPropagation()
  }

  // Capture phase, so the webview's own handling never sees the key first.
  target.addEventListener('contextmenu', onContextMenu, true)
  target.addEventListener('keydown', onKeyDown, true)

  return () => {
    target.removeEventListener('contextmenu', onContextMenu, true)
    target.removeEventListener('keydown', onKeyDown, true)
  }
}

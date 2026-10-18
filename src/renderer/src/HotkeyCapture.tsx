import { useEffect, useRef, useState } from 'react'

/**
 * Hotkey capture: click the field, press the combination (or just the key /
 * mouse button), release to commit. Escape cancels.
 *
 * The app binds input through a low-level system hook rather than the platform
 * shortcut API, so every key is bindable on its own — including CapsLock —
 * and any mouse button can be used, alone or with modifiers. That means we do
 * not reject single-key bindings the way the old capture had to.
 *
 * Commits accelerator strings understood by the Rust parser, e.g.
 * `CommandOrControl+Alt+Space`, `CapsLock`, `K`, `F5`, `Ctrl+Mouse4`.
 */

interface PressedKey {
  code: string
  key: string
}

const MODIFIER_ORDER = ['CommandOrControl', 'Alt', 'Shift', 'Super']

const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
  'MetaLeft',
  'MetaRight'
])

/** DOM `MouseEvent.button` values that we allow as bindings. */
const MOUSE_BUTTONS: Record<number, string> = {
  0: 'Mouse1',
  1: 'Mouse3',
  2: 'Mouse2',
  3: 'Mouse4',
  4: 'Mouse5'
}

const MOUSE_LABELS: Record<string, string> = {
  Mouse1: 'Mouse left',
  Mouse2: 'Mouse right',
  Mouse3: 'Mouse middle',
  Mouse4: 'Mouse back',
  Mouse5: 'Mouse forward'
}

export function codeToName(code: string, key: string): string | null {
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CommandOrControl'
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt'
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift'
  if (code === 'MetaLeft' || code === 'MetaRight') return 'Super'
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-2])$/.test(code)) return code
  const map: Record<string, string> = {
    Space: 'Space',
    Tab: 'Tab',
    Enter: 'Return',
    NumpadEnter: 'Return',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Insert: 'Insert',
    Delete: 'Delete',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Numpad0: 'num0',
    Numpad1: 'num1',
    Numpad2: 'num2',
    Numpad3: 'num3',
    Numpad4: 'num4',
    Numpad5: 'num5',
    Numpad6: 'num6',
    Numpad7: 'num7',
    Numpad8: 'num8',
    Numpad9: 'num9',
    NumpadDecimal: 'numdec',
    NumpadAdd: 'numadd',
    NumpadSubtract: 'numsub',
    NumpadMultiply: 'nummult',
    NumpadDivide: 'numdiv',
    CapsLock: 'CapsLock',
    PrintScreen: 'PrintScreen',
    ScrollLock: 'ScrollLock',
    Pause: 'Pause',
    NumLock: 'NumLock',
    Escape: 'Escape'
  }
  if (code in map) return map[code]
  if (key.length === 1) return key.toUpperCase()
  return null
}

/**
 * Build the accelerator string for the current set of pressed keys.
 * Modifiers are ordered canonically and the single non-modifier key (or mouse
 * button) becomes the main trigger.
 */
export function toAccelerator(pressed: PressedKey[], mouseButton?: string): string | null {
  const modifiers: string[] = []
  let main: string | null = null

  for (const { code, key } of pressed) {
    const name = codeToName(code, key)
    if (!name) continue
    if (MODIFIER_ORDER.includes(name)) {
      if (!modifiers.includes(name)) modifiers.push(name)
    } else if (main === null) {
      main = name
    }
  }

  if (main === null && mouseButton) main = mouseButton
  if (!main) return null

  modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b))
  return [...modifiers, main].join('+')
}

/**
 * Kept for backwards compatibility with callers that used to reject bare keys.
 * Every trigger is bindable now, so this always succeeds for a non-empty
 * accelerator produced by {@link toAccelerator}.
 */
export function isRegisterable(accelerator: string): boolean {
  return accelerator.length > 0
}

export function prettyHotkey(accelerator: string): string {
  if (!accelerator) return 'Not set'
  return accelerator
    .replace(/CommandOrControl/g, 'Ctrl')
    .split('+')
    .map((part) => MOUSE_LABELS[part] ?? part)
    .join(' + ')
}

export default function HotkeyCapture({
  value,
  allowEmpty = false,
  onCommit
}: {
  value: string
  allowEmpty?: boolean
  onCommit: (accelerator: string) => void
}) {
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState('')
  const [error, setError] = useState('')
  const pressedRef = useRef<PressedKey[]>([])
  const snapshotRef = useRef<PressedKey[]>([])
  const mouseRef = useRef<string | undefined>(undefined)
  const boxRef = useRef<HTMLDivElement>(null)

  const reset = () => {
    pressedRef.current = []
    snapshotRef.current = []
    mouseRef.current = undefined
    setLive('')
    setError('')
    setListening(false)
  }

  useEffect(() => {
    if (listening) boxRef.current?.focus()
  }, [listening])

  const commit = () => {
    const acc = toAccelerator(snapshotRef.current, mouseRef.current)
    reset()
    if (!acc) return
    onCommit(acc)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Keep the capture focused: Tab and the Windows key would otherwise move
    // focus or open the Start menu mid-capture.
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape' && pressedRef.current.length === 0) {
      reset()
      return
    }
    if (e.repeat) return

    const pressed = pressedRef.current
    if (!pressed.some((k) => k.code === e.code)) {
      pressed.push({ code: e.code, key: e.key })
    }
    snapshotRef.current = [...pressed]
    const acc = toAccelerator(pressed, mouseRef.current)
    setLive(acc ? prettyHotkey(acc) : '')
    setError('')
  }

  const onKeyUp = (e: React.KeyboardEvent) => {
    e.preventDefault()
    const wasMain = !MODIFIER_CODES.has(e.code)
    pressedRef.current = pressedRef.current.filter((k) => k.code !== e.code)

    // Commit as soon as the trigger key is released. If only modifiers are
    // still held (or nothing is), the capture is also complete.
    if (wasMain || pressedRef.current.length === 0) {
      if (snapshotRef.current.length > 0) commit()
      else reset()
    }
  }

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const name = MOUSE_BUTTONS[e.button]
    if (!name) return
    setListening(true)
    mouseRef.current = name
    snapshotRef.current = [...pressedRef.current]
    const acc = toAccelerator(pressedRef.current, name)
    setLive(acc ? prettyHotkey(acc) : '')
    setError('')
  }

  const onMouseUp = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!mouseRef.current) return
    if (MOUSE_BUTTONS[e.button]) commit()
  }

  const onContextMenu = (e: React.MouseEvent) => e.preventDefault()

  if (!listening) {
    return (
      <div className="hotkey-row">
        <button className="hotkey-field" onClick={() => setListening(true)} title="Click to change">
          {prettyHotkey(value)}
        </button>
        {allowEmpty && value && (
          <button className="btn" onClick={() => onCommit('')}>
            Clear
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="hotkey-capture">
      <div
        ref={boxRef}
        tabIndex={0}
        role="textbox"
        aria-label="Press a key or mouse button"
        className="hotkey-field listening"
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
        onBlur={reset}
      >
        {live || 'Press a key or mouse button'}
      </div>
      {error ? <p className="hotkey-error">{error}</p> : null}
    </div>
  )
}
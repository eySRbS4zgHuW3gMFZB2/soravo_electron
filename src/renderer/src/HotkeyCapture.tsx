import { useEffect, useRef, useState } from 'react'

/**
 * Wispr-style hotkey capture: click the field, press the key combination,
 * release to commit. Escape cancels. Commits Electron accelerator strings
 * (e.g. CommandOrControl+Alt+Space). Single keys are rejected unless they
 * are function or media keys, which is all Electron globalShortcut supports.
 */

interface PressedKey {
  code: string
  key: string
}

const MODIFIER_ORDER = ['CommandOrControl', 'Alt', 'Shift', 'Super']

export function codeToName(code: string, key: string): string | null {
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CommandOrControl'
  if (code === 'AltLeft' || code === 'AltRight') return 'Alt'
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift'
  if (code === 'MetaLeft' || code === 'MetaRight') return 'Super'
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
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
    MediaPlayPause: 'MediaPlayPause',
    CapsLock: 'CapsLock',
    PrintScreen: 'PrintScreen',
    Pause: 'Pause',
    ScrollLock: 'ScrollLock',    MediaTrackNext: 'MediaNextTrack',
    MediaTrackPrevious: 'MediaPreviousTrack',
    MediaStop: 'MediaStop'
  }
  if (code in map) return map[code]
  if (key.length === 1) return key.toUpperCase()
  return null
}

export function toAccelerator(pressed: PressedKey[]): string | null {
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
  if (!main) return null
  modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b))
  return [...modifiers, main].join('+')
}

export function isRegisterable(accelerator: string): boolean {
  const parts = accelerator.split('+')
  const main = parts[parts.length - 1]
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(main)) return true
  if (main.startsWith('Media')) return true
  return parts.length > 1
}

export function prettyHotkey(accelerator: string): string {
  if (!accelerator) return 'Not set'
  return accelerator.replace(/CommandOrControl/g, 'Ctrl').split('+').join(' + ')
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
  const boxRef = useRef<HTMLDivElement>(null)

  const cancel = () => {
    pressedRef.current = []
    snapshotRef.current = []
    setLive('')
    setError('')
    setListening(false)
  }

  useEffect(() => {
    if (listening) boxRef.current?.focus()
  }, [listening])

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') {
      cancel()
      return
    }
    if (e.repeat) return
    const pressed = pressedRef.current
    if (!pressed.some((k) => k.code === e.code)) {
      pressed.push({ code: e.code, key: e.key })
    }
    snapshotRef.current = [...pressed]
    const acc = toAccelerator(pressed)
    setLive(acc ? prettyHotkey(acc) : '')
    setError('')
  }

  const onKeyUp = (e: React.KeyboardEvent) => {
    e.preventDefault()
    pressedRef.current = pressedRef.current.filter((k) => k.code !== e.code)
    if (pressedRef.current.length > 0) return
    const acc = toAccelerator(snapshotRef.current)
    snapshotRef.current = []
    if (!acc) {
      cancel()
      return
    }
    if (!isRegisterable(acc)) {
      setLive('')
      setError('Add a modifier (Ctrl, Alt or Shift). Function keys work alone.')
      return
    }
    onCommit(acc)
    cancel()
  }

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setError('Mouse buttons need a system hook — keyboard combos only for now.')
  }

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
        className="hotkey-field listening"
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onMouseDown={onMouseDown}
        onBlur={cancel}
      >
        {live || 'Press key or mouse button'}
      </div>
      {error ? <p className="hotkey-error">{error}</p> : null}
    </div>
  )
}

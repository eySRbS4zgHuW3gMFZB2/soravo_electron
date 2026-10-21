import { useEffect, useRef, useState } from 'react'
import ShortcutKeys from '@/components/pages/ShortcutKeys'

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

import {
  codeToName,
  isRegisterable,
  MODIFIER_CODES,
  MODIFIER_ORDER,
  MOUSE_BUTTONS,
  prettyHotkey,
  toAccelerator,
  type PressedKey
} from './hotkeys'

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
      <button
        type="button"
        className="hotkey-field"
        onClick={() => setListening(true)}
        title="Click to change"
      >
        {value ? <ShortcutKeys value={value} /> : <span className="hotkey-empty">Not set</span>}
      </button>
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
/**
 * The names the app binds shortcuts with.
 *
 * The capture records a key by the name the native side parses, so the
 * window has to name a key the same way when it decides whether a key press
 * is the shortcut. Both go through {@link codeToName} here, which is the
 * only place a key code becomes a name.
 */

export interface PressedKey {
  code: string
  key: string
}

export const MODIFIER_ORDER = ['CommandOrControl', 'Alt', 'Shift', 'Super']

export const MODIFIER_CODES = new Set([
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
export const MOUSE_BUTTONS: Record<number, string> = {
  0: 'Mouse1',
  1: 'Mouse3',
  2: 'Mouse2',
  3: 'Mouse4',
  4: 'Mouse5'
}

export const MOUSE_LABELS: Record<string, string> = {
  Mouse1: 'Mouse left',
  Mouse2: 'Mouse right',
  Mouse3: 'Mouse middle',
  Mouse4: 'Mouse back',
  Mouse5: 'Mouse forward'
}

/** The modifier names a binding can carry. */
const MODIFIER_NAMES = [
  'commandorcontrol',
  'command',
  'ctrl',
  'control',
  'alt',
  'shift',
  'meta',
  'super'
]

/** The name of a key, as the native side knows it. */
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

/**
 * Does a key event match a binding?
 *
 * The trigger is compared by name, through the same {@link codeToName} the
 * capture records with - so a space bar is "Space" and an arrow key is "Up",
 * the way the binding stores them, and not the `KeyboardEvent.key` the
 * browser reports (" " and "ArrowUp").
 */
export function matchesHotkey(
  e: {
    code: string
    key: string
    ctrlKey: boolean
    altKey: boolean
    shiftKey: boolean
    metaKey: boolean
  },
  binding: string
): boolean {
  const parts = binding
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  const trigger = parts.find((p) => !MODIFIER_NAMES.includes(p.toLowerCase()))
  if (!trigger) return false
  const needsCtrl = parts.some((p) =>
    ['commandorcontrol', 'command', 'ctrl', 'control'].includes(p.toLowerCase())
  )
  const needsAlt = parts.some((p) => p.toLowerCase() === 'alt')
  const needsShift = parts.some((p) => p.toLowerCase() === 'shift')

  const pressed = codeToName(e.code, e.key)
  if (!pressed) return false

  return (
    needsCtrl === (e.ctrlKey || e.metaKey) &&
    needsAlt === e.altKey &&
    needsShift === e.shiftKey &&
    pressed.toLowerCase() === trigger.toLowerCase()
  )
}

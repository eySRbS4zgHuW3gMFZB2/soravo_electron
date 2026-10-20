import { Kbd, KbdGroup } from '@/components/ui/kbd'

/**
 * The keys of a shortcut, one per key.
 *
 * The binding is the accelerator grammar the native side parses -
 * `CommandOrControl+Alt+Space` - and the platform's own modifier name is
 * used, so the chips read the way the user would say them.
 */
function keyLabel(part: string): string {
  const key = part.trim()
  if (!key) return ''
  switch (key.toLowerCase()) {
    case 'commandorcontrol':
    case 'command':
    case 'ctrl':
    case 'control':
      return isMac ? '⌘' : 'Ctrl'
    case 'cmdorctrl':
      return '⌘'
    case 'alt':
    case 'option':
      return isMac ? '⌥' : 'Alt'
    case 'shift':
      return '⇧'
    case 'super':
    case 'meta':
    case 'win':
      return isMac ? '⌘' : 'Win'
    case 'space':
      return 'Space'
    default:
      return key.length === 1 ? key.toUpperCase() : key
  }
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '')

/** The shortcut as a row of key chips. */
export default function ShortcutKeys({
  value,
  empty = 'Not set',
  className
}: {
  value: string
  empty?: string
  className?: string
}) {
  const parts = value
    .split('+')
    .map((p) => keyLabel(p))
    .filter(Boolean)

  if (!parts.length) {
    return <span className={className}>{empty}</span>
  }

  return (
    <KbdGroup className={className}>
      {parts.map((part, index) => (
        <Kbd key={`${part}-${index}`}>{part}</Kbd>
      ))}
    </KbdGroup>
  )
}

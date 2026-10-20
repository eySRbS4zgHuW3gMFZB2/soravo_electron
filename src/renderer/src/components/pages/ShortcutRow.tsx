import type { ReactNode } from 'react'
import ShortcutKeys from './ShortcutKeys'
import { TrashIcon } from './icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * One row of the shortcuts list.
 *
 * The shape follows Wispr Flow's shortcut section: the label sits on the left
 * and the control on the right, so the eye can scan the list down the labels
 * and across the keys.
 */
export default function ShortcutRow({
  title,
  description,
  shortcut,
  empty = 'Not set',
  onClear,
  control,
  className
}: {
  title: string
  description: string
  /** The accelerator, when the row is a shortcut row. */
  shortcut?: string
  empty?: string
  /** Clears the binding. Only shown when there is one. */
  onClear?: () => void
  /** Anything else the row controls with - a switch, for instance. */
  control?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('shortcut-item', className)}>
      <div className="shortcut-item-row">
        <div className="shortcut-item-label">
          <p className="shortcut-item-title">{title}</p>
          <p className="shortcut-item-desc">{description}</p>
        </div>
        {control ??
          (shortcut !== undefined ? (
            <div className="shortcut-item-keys">
              <ShortcutKeys value={shortcut} empty={empty} />
              {onClear && shortcut ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClear}
                  title="Remove this shortcut"
                  aria-label="Remove this shortcut"
                >
                  <TrashIcon size={15} />
                </Button>
              ) : null}
            </div>
          ) : null)}
      </div>
    </div>
  )
}

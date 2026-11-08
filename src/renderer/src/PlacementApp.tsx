import { useCallback, useEffect, useRef, useState } from 'react'
import { PILL_ANCHORS, type PillAnchor } from './soravo'
import './placement.css'

const ZONE_LABELS: Record<PillAnchor, string> = {
  'top-left': 'Top left',
  'top-center': 'Top center',
  'top-right': 'Top right',
  'center-left': 'Centre left',
  'center-center': 'Centre',
  'center-right': 'Centre right',
  'bottom-left': 'Bottom left',
  'bottom-center': 'Bottom centre',
  'bottom-right': 'Bottom right',
}

export default function PlacementApp() {
  const [current, setCurrent] = useState<PillAnchor>('bottom-center')
  const [hot, setHot] = useState<PillAnchor | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const zoneRefs = useRef<Map<PillAnchor, HTMLButtonElement>>(new Map())

  useEffect(() => {
    window.soravo.getPillAnchor().then(setCurrent).catch(() => {})
  }, [])

  const choose = useCallback(async (anchor: PillAnchor) => {
    try {
      await window.soravo.setPillAnchor(anchor)
      await window.soravo.flashPillPreview()
    } catch (e) {
      console.error('Could not set the pill anchor', e)
    } finally {
      await window.soravo.closePlacementMode().catch(() => {})
    }
  }, [])

  const cancel = useCallback(() => {
    void window.soravo.closePlacementMode().catch(() => {})
  }, [])

  // Esc cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  // Ghost-pill dragging. Pointer events on the ghost; hit-testing the zones
  // on every move; drop selects the zone under the pointer.
  const zoneAt = (x: number, y: number): PillAnchor | null => {
    for (const [anchor, el] of zoneRefs.current) {
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return anchor
    }
    return null
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setGhost({ x: e.clientX, y: e.clientY })
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ghost) return
    setGhost({ x: e.clientX, y: e.clientY })
    setHot(zoneAt(e.clientX, e.clientY))
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ghost) return
    const target = zoneAt(e.clientX, e.clientY)
    setGhost(null)
    setHot(null)
    if (target) void choose(target)
  }

  return (
    <div className="placement-root">
      <header className="placement-head">
        <h1 className="placement-title">Where should the pill live?</h1>
        <p className="placement-hint">Drag the capsule to a zone, or click one. Esc cancels.</p>
      </header>

      <div
        className="ghost-pill"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={ghost ? { position: 'fixed', left: 0, top: 0, transform: `translate(${ghost.x - 56}px, ${ghost.y - 15}px)`, cursor: 'grabbing' } : undefined}
        aria-hidden={ghost ? 'true' : undefined}
        role="img"
        aria-label="Pill — drag to a zone"
      >
        <i /><i /><i />
      </div>

      <div className="placement-grid" role="radiogroup" aria-label="Pill position">
        {PILL_ANCHORS.map((anchor) => (
          <button
            key={anchor}
            type="button"
            ref={(el) => {
              if (el) zoneRefs.current.set(anchor, el)
              else zoneRefs.current.delete(anchor)
            }}
            className="placement-zone"
            data-hot={hot === anchor || current === anchor}
            aria-pressed={current === anchor}
            onClick={() => void choose(anchor)}
          >
            <span className="placement-zone-label">{ZONE_LABELS[anchor]}</span>
          </button>
        ))}
      </div>

      <div className="placement-actions">
        <button type="button" className="placement-cancel" onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

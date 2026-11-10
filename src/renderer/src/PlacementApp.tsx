import { useCallback, useEffect, useRef, useState } from 'react'
import { PILL_ANCHORS, type PillAnchor } from './pillAnchors'
import { ZONE_LABELS, zoneAtPoint, type ZoneRect } from './placementModel'
import './placement.css'

export default function PlacementApp() {
  const [current, setCurrent] = useState<PillAnchor>('bottom-center')
  const [hot, setHot] = useState<PillAnchor | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const zoneRefs = useRef<Map<PillAnchor, HTMLButtonElement>>(new Map())
  // Synchronous drag identity. The event handlers must know which pointer
  // is being dragged without waiting for a React re-render.
  const dragPointerId = useRef<number | null>(null)

  // Re-read the persisted anchor whenever the placement window is shown;
  // the window is reused across opens, so a one-shot read at mount would
  // show a stale selection.
  const refreshCurrent = useCallback(() => {
    window.soravo.getPillAnchor().then(setCurrent).catch(() => {})
  }, [])

  useEffect(() => refreshCurrent(), [refreshCurrent])

  useEffect(() => window.soravo.onPlacementShown(() => refreshCurrent()), [refreshCurrent])

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

  const endDrag = useCallback(() => {
    dragPointerId.current = null
    setDragging(false)
    setGhost(null)
    setHot(null)
  }, [])

  const cancel = useCallback(() => {
    endDrag()
    void window.soravo.closePlacementMode().catch(() => {})
  }, [endDrag])

  // Esc cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  // Snapshot the zone rects in CSS pixels (viewport-relative).
  const zoneRects = (): ZoneRect[] => {
    const rects: ZoneRect[] = []
    for (const [anchor, el] of zoneRefs.current) {
      const r = el.getBoundingClientRect()
      rects.push({ anchor, left: r.left, top: r.top, right: r.right, bottom: r.bottom })
    }
    return rects
  }

  const updateDrag = useCallback((x: number, y: number) => {
    setGhost({ x, y })
    setHot(zoneAtPoint(zoneRects(), x, y))
  }, [])

  /**
   * Finish the drag. When `commit` is true (a real pointer release), the
   * zone under the pointer is committed; when false (cancellation, focus
   * loss, pointer interruption), nothing is committed.
   */
  const finishDrag = useCallback(
    (x: number, y: number, commit: boolean) => {
      if (dragPointerId.current === null) return
      if (commit) {
        const target = zoneAtPoint(zoneRects(), x, y)
        endDrag()
        // Release outside every zone: keep the placement open, change nothing.
        if (target) void choose(target)
        return
      }
      endDrag()
    },
    [choose, endDrag],
  )

  // One authoritative drag lifecycle, driven by window-level listeners so a
  // release is never lost to a retargeting quirk of the ghost element.
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId.current) return
      e.preventDefault()
      updateDrag(e.clientX, e.clientY)
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId.current) return
      finishDrag(e.clientX, e.clientY, true)
    }
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId.current) return
      finishDrag(0, 0, false)
    }
    const onBlur = () => finishDrag(0, 0, false)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('lostpointercapture', onCancel)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('lostpointercapture', onCancel)
      window.removeEventListener('blur', onBlur)
    }
  }, [dragging, finishDrag, updateDrag])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    dragPointerId.current = e.pointerId
    setDragging(true)
    updateDrag(e.clientX, e.clientY)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // The window-level listeners above still drive the drag.
    }
  }

  return (
    <div className="placement-root">
      <header className="placement-head">
        <h1 className="placement-title">Where should the pill live?</h1>
        <p className="placement-hint">Drag the capsule to a zone, or click one. Esc cancels.</p>
      </header>

      {/* The slot keeps the ghost's footprint while it is position:fixed so
          the grid does not re-centre between pointer down and the drop. */}
      <div className="ghost-slot">
        <div
          className="ghost-pill"
          onPointerDown={onPointerDown}
          style={ghost ? { position: 'fixed', left: 0, top: 0, transform: `translate(${ghost.x - 56}px, ${ghost.y - 15}px)`, cursor: 'grabbing' } : undefined}
          aria-hidden={ghost ? 'true' : undefined}
          role="img"
          aria-label="Pill — drag to a zone"
        >
          <i /><i /><i />
        </div>
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

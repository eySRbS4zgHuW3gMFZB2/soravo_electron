import { describe, expect, it } from 'vitest'
import {
  PILL_ANCHORS,
  type PillAnchor,
} from '../src/renderer/src/pillAnchors'
import { ZONE_LABELS, zoneAtPoint, type ZoneRect } from '../src/renderer/src/placementModel'

/**
 * The nine positions, laid out the way the 3×3 grid and the placement
 * window lay them out (reading order: top row, centre row, bottom row).
 */
const EXPECTED_ANCHORS: PillAnchor[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center-center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

function gridRects(width = 900, height = 560): ZoneRect[] {
  const cellW = width / 3
  const cellH = height / 3
  return EXPECTED_ANCHORS.map((anchor, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    return { anchor, left: col * cellW, top: row * cellH, right: (col + 1) * cellW, bottom: (row + 1) * cellH }
  })
}

describe('PILL_ANCHORS', () => {
  it('contains all nine positions in reading order', () => {
    expect(PILL_ANCHORS).toEqual(EXPECTED_ANCHORS)
  })

  it('has nine distinct kebab-case identifiers', () => {
    expect(new Set(PILL_ANCHORS).size).toBe(9)
    for (const anchor of PILL_ANCHORS) expect(anchor).toMatch(/^[a-z]+-[a-z]+$/)
  })

  it('has a label and an anchor for every grid cell', () => {
    for (const anchor of PILL_ANCHORS) {
      expect(ZONE_LABELS[anchor]).toBeTruthy()
    }
    expect(Object.keys(ZONE_LABELS)).toHaveLength(9)
  })
})

describe('zoneAtPoint', () => {
  const rects = gridRects()

  it.each(EXPECTED_ANCHORS)('hits %s at its cell centre', (anchor) => {
    const cell = rects.find((r) => r.anchor === anchor)!
    const cx = (cell.left + cell.right) / 2
    const cy = (cell.top + cell.bottom) / 2
    expect(zoneAtPoint(rects, cx, cy)).toBe(anchor)
  })

  it('hits the side zones (the cells that previously resolved to centre)', () => {
    // Middle row, left and right cells.
    expect(zoneAtPoint(rects, 1, 280)).toBe('center-left')
    expect(zoneAtPoint(rects, 899, 280)).toBe('center-right')
    expect(zoneAtPoint(rects, 1, 1)).toBe('top-left')
    expect(zoneAtPoint(rects, 899, 559)).toBe('bottom-right')
  })

  it('returns null outside every zone', () => {
    expect(zoneAtPoint(rects, -10, 280)).toBeNull()
    expect(zoneAtPoint(rects, 10_000, 280)).toBeNull()
    expect(zoneAtPoint(rects, 450, -10)).toBeNull()
    expect(zoneAtPoint(rects, 450, 10_000)).toBeNull()
  })

  it('treats zone edges as inside the zone', () => {
    // A release exactly on a shared boundary still selects a zone;
    // first match wins, which matches DOM hit order.
    expect(zoneAtPoint(rects, 300, 280)).toBe('center-left')
    expect(zoneAtPoint(rects, 600, 280)).toBe('center-center')
  })

  it('distinguishes overlapping-edge cells instead of falling back to centre', () => {
    expect(zoneAtPoint(rects, 0, 0)).toBe('top-left')
    expect(zoneAtPoint(rects, 900, 560)).toBe('bottom-right')
    expect(zoneAtPoint(rects, 450, 280)).toBe('center-center')
  })
})

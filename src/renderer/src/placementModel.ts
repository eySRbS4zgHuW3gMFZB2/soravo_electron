import { type PillAnchor } from './pillAnchors'

/**
 * Pure helpers for the placement (reposition) mode, kept separate from the
 * React component so they can be unit-tested without a DOM.
 */

/** A rectangular hit target for one of the nine zones, in CSS pixels. */
export interface ZoneRect {
  anchor: PillAnchor
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Return the zone whose rectangle contains `(x, y)`, or `null` when the
 * point is outside every zone. Edges are inclusive so a release exactly on
 * a zone boundary still selects that zone.
 */
export function zoneAtPoint(zones: readonly ZoneRect[], x: number, y: number): PillAnchor | null {
  for (const zone of zones) {
    if (x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom) {
      return zone.anchor
    }
  }
  return null
}

/** Human labels for the nine zones, keyed by anchor string. */
export const ZONE_LABELS: Record<PillAnchor, string> = {
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

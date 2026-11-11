/**
 * The nine pill dock positions — the single canonical frontend
 * representation of a pill anchor. Kept free of Tauri imports so it can be
 * used (and tested) anywhere. Mirrors `PillAnchor` in src-tauri/src/lib.rs.
 */
export type PillAnchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center-center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export const PILL_ANCHORS: PillAnchor[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center-center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

import { Check, Minus } from 'lucide-react'

/**
 * Shared icon set for both windows.
 *
 * These are the glyphs the app has always shipped. Most of them were copied
 * from an older lucide release, and lucide v1.59 has since redrawn several of
 * them (the mic capsule, the gear teeth, the trash can's inner rules, the
 * brain, the insights trend, the history arc). Swapping those in would change
 * how the app looks, so they are kept verbatim.
 *
 * Where v1.59 is still byte-identical to the old drawing - `X`, `Minus` and
 * `Check` - the upstream component is used directly.
 *
 * Sizes come from CSS rules that target `svg` inside the owning button
 * (`.hub-winbtn svg`, `.icon-btn svg`, `.mini-ok svg`, ...), so these
 * components deliberately set no width or height of their own.
 */

/** lucide v1.59 `x` is path-identical to the app's original. */
export function CloseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
}

/** lucide v1.59 `minus` is path-identical to the app's original. */
export function MinimizeIcon() {
  return <Minus aria-hidden="true" />
}

/** lucide v1.59 `check` is path-identical, but the app draws it a little heavier. */
export function CheckIcon() {
  return <Check strokeWidth={2.5} aria-hidden="true" />
}

/** No lucide equivalent at this geometry - the window button shows a 14px box. */
export function MaximizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}

export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 18v4" />
    </svg>
  )
}

export function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  )
}

export function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </svg>
  )
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}

export function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 14l4-4 3 3 5-6" />
    </svg>
  )
}

export function ScratchpadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 3v4h4" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  )
}

export function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0-3 3 3 3 0 0 0 1 5.66V17a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1.34A3 3 0 0 0 20 11a3 3 0 0 0-3-3V6a4 4 0 0 0-4-4z" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  )
}
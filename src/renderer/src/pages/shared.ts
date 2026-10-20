import { useMemo } from 'react'
import type { TranscriptEntry } from '../soravo'

/** 3:51pm - the time format the transcript feed uses. */
export function timeHM(iso: string): string {
  const d = new Date(iso)
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = d.getHours() >= 12 ? 'pm' : 'am'
  const hours = d.getHours() % 12 || 12
  return `${hours}:${minutes}${ampm}`
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Does a keyboard event match an accelerator-style binding?
 *
 * The binding is the same grammar the native side parses: modifiers, then
 * the trigger. `CommandOrControl` matches either Ctrl or the Windows key.
 */
export function matchesHotkey(
  e: { key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
  binding: string
): boolean {
  const parts = binding
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return false
  const modifiers = ['commandorcontrol', 'command', 'ctrl', 'control', 'alt', 'shift', 'meta', 'super']
  const needsCtrl = parts.some((p) => ['commandorcontrol', 'command', 'ctrl', 'control'].includes(p))
  const needsAlt = parts.includes('alt')
  const needsShift = parts.includes('shift')
  const triggerKey = parts.filter((p) => !modifiers.includes(p))[0]
  if (!triggerKey) return false
  return (
    needsCtrl === (e.ctrlKey || e.metaKey) &&
    needsAlt === e.altKey &&
    needsShift === e.shiftKey &&
    e.key.toLowerCase() === triggerKey
  )
}

export type HubStats = {
  words: number
  wpm: number
  streak: number
  todayWords: number
  todayCount: number
}

export function useStats(history: TranscriptEntry[]): HubStats {
  return useMemo(() => {
    let words = 0
    let rateWords = 0
    let rateMs = 0
    const days = new Set<string>()
    for (const h of history) {
      const w = countWords(h.text)
      words += w
      days.add(dayKey(new Date(h.createdAt)))
      if (h.durationMs && h.durationMs > 0) {
        rateWords += w
        rateMs += h.durationMs
      }
    }
    let streak = 0
    const cursor = new Date()
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
    while (days.has(dayKey(cursor))) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    const today = dayKey(new Date())
    let todayWords = 0
    let todayCount = 0
    for (const h of history) {
      if (dayKey(new Date(h.createdAt)) !== today) continue
      todayWords += countWords(h.text)
      todayCount += 1
    }
    return {
      words,
      wpm: rateMs > 0 ? Math.round((rateWords / rateMs) * 60000) : 0,
      streak,
      todayWords,
      todayCount
    }
  }, [history])
}

/**
 * Splits an accelerator into the individual keys, so the greeting can show
 * them as separate chips the way Wispr Flow shows "Ctrl + Win".
 */
export function hotkeyKeys(accelerator: string): string[] {
  return accelerator
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase()
      if (lower === 'commandorcontrol' || lower === 'cmdorctrl' || lower === 'control') return 'Ctrl'
      if (lower === 'command' || lower === 'cmd') return 'Win'
      if (lower === 'super' || lower === 'meta') return 'Win'
      if (lower === 'option' || lower === 'alt') return 'Alt'
      if (lower === 'shift') return 'Shift'
      if (lower === 'space') return 'Space'
      if (lower === 'escape' || lower === 'esc') return 'Esc'
      if (part.length === 1) return part.toUpperCase()
      return part
    })
}

/** "Today" / "Yesterday" / "October 16, 2026" - the date eyebrow above a feed. */
export function dayLabel(date: Date): string {
  const today = dayKey(new Date())
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const key = dayKey(date)
  if (key === today) return 'Today'
  if (key === dayKey(yesterdayDate)) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

/** Groups a transcript list into date buckets, newest first. */
export function groupByDay(history: TranscriptEntry[]): Array<{ key: string; label: string; entries: TranscriptEntry[] }> {
  const buckets = new Map<string, { date: Date; entries: TranscriptEntry[] }>()
  for (const entry of history) {
    const date = new Date(entry.createdAt)
    const key = dayKey(date)
    const bucket = buckets.get(key)
    if (bucket) bucket.entries.push(entry)
    else buckets.set(key, { date, entries: [entry] })
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({ key, label: dayLabel(bucket.date), entries: bucket.entries }))
    .sort((a, b) => b.key.localeCompare(a.key, undefined, { numeric: true }))
}

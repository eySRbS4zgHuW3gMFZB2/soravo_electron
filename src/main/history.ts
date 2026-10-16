import { app } from 'electron'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'

export interface TranscriptEntry {
  id: number
  text: string
  createdAt: string
  durationMs: number | null
}

let db: DatabaseSync | null = null

export function openHistory(): DatabaseSync {
  if (db) return db
  db = new DatabaseSync(join(app.getPath('userData'), 'soravo.sqlite'))
  db.exec(`CREATE TABLE IF NOT EXISTS transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    duration_ms INTEGER NULL
  )`)
  return db
}

interface HistoryRow {
  id: number
  text: string
  createdAt: string
  durationMs: number | null
}

const ROW_SQL =
  'SELECT id, text, created_at AS createdAt, duration_ms AS durationMs FROM transcriptions'

export function addTranscription(text: string, durationMs: number | null): TranscriptEntry {
  const d = openHistory()
  const info = d.prepare('INSERT INTO transcriptions (text, duration_ms) VALUES (?, ?)').run(text, durationMs)
  const row = d.prepare(`${ROW_SQL} WHERE id = ?`).get(info.lastInsertRowid) as HistoryRow | undefined
  if (!row) throw new Error('Failed to read back saved transcription')
  return row
}

export function listTranscriptions(limit: number): TranscriptEntry[] {
  const d = openHistory()
  const safe = Math.min(Math.max(Math.floor(limit), 1), 200)
  return d.prepare(`${ROW_SQL} ORDER BY id DESC LIMIT ?`).all(safe) as TranscriptEntry[]
}

export function clearTranscriptions(): void {
  openHistory().exec('DELETE FROM transcriptions')
}

export function deleteTranscription(id: number): void {
  openHistory().prepare('DELETE FROM transcriptions WHERE id = ?').run(id)
}

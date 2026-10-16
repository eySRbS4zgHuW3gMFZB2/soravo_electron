import { app } from 'electron'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'

export interface TranscriptEntry {
  id: number
  text: string
  createdAt: string
  durationMs: number | null
}

export interface InsightsData {
  dictations: number
  words: number
  audioMinutes: number
  avgWpm: number
  topWpm: number
  dayStreak: number
  longestStreak: number
  correctionsFillers: number
  correctionsVocab: number
  perDay: Array<{ date: string; words: number }>
  /** words per hour, index 0-23 local time */
  perHour: number[]
  /** words per weekday, index 0 = Monday */
  perWeekday: number[]
  topWords: Array<{ word: string; count: number }>
  topPhrases: Array<{ phrase: string; count: number }>
}

let db: DatabaseSync | null = null

export function openHistory(): DatabaseSync {
  if (db) return db
  db = new DatabaseSync(join(app.getPath('userData'), 'soravo.sqlite'))
  db.exec(`CREATE TABLE IF NOT EXISTS transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    duration_ms INTEGER NULL,
    fillers_removed INTEGER NOT NULL DEFAULT 0,
    vocab_applied INTEGER NOT NULL DEFAULT 0
  )`)
  const columns = db
    .prepare('PRAGMA table_info(transcriptions)')
    .all() as Array<{ name: string }>
  const names = new Set(columns.map((c) => c.name))
  if (!names.has('fillers_removed')) {
    db.exec('ALTER TABLE transcriptions ADD COLUMN fillers_removed INTEGER NOT NULL DEFAULT 0')
  }
  if (!names.has('vocab_applied')) {
    db.exec('ALTER TABLE transcriptions ADD COLUMN vocab_applied INTEGER NOT NULL DEFAULT 0')
  }
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

export function addTranscription(
  text: string,
  durationMs: number | null,
  fillersRemoved = 0,
  vocabApplied = 0
): TranscriptEntry {
  const d = openHistory()
  const info = d
    .prepare(
      'INSERT INTO transcriptions (text, duration_ms, fillers_removed, vocab_applied) VALUES (?, ?, ?, ?)'
    )
    .run(text, durationMs, fillersRemoved, vocabApplied)
  const row = d.prepare(`${ROW_SQL} WHERE id = ?`).get(info.lastInsertRowid) as HistoryRow | undefined
  if (!row) throw new Error('Failed to read back saved transcription')
  return row
}

export function listTranscriptions(limit: number): TranscriptEntry[] {
  const d = openHistory()
  const safe = Math.min(Math.max(Math.floor(limit), 1), 200)
  return d.prepare(`${ROW_SQL} ORDER BY id DESC LIMIT ?`).all(safe) as TranscriptEntry[]
}

export function deleteTranscription(id: number): void {
  openHistory().prepare('DELETE FROM transcriptions WHERE id = ?').run(id)
}

export function clearTranscriptions(): void {
  openHistory().exec('DELETE FROM transcriptions')
}

export type RetentionMode = 'all' | '30days' | 'session'

export function pruneHistory(retention: RetentionMode): void {
  const d = openHistory()
  if (retention === 'session') {
    d.exec('DELETE FROM transcriptions')
  } else if (retention === '30days') {
    d.exec(
      "DELETE FROM transcriptions WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')"
    )
  }
}

const STOPWORDS = new Set(
  'a,an,the,and,or,but,if,then,else,for,to,of,in,on,at,by,with,from,as,is,are,was,were,be,been,it,its,this,that,these,those,i,you,he,she,we,they,me,him,her,us,them,my,your,his,our,their,not,no,so,do,does,did,can,will,just,like,get,got,one,all,have,has,had,am,nor,up,out,about,into,over,after,before,between,through,than,too,very,should,now,also,well,yeah,yes,ok,okay,um,uh,er,ah,hmm'.split(
    ','
  )
)

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
}

export function getInsights(): InsightsData {
  const d = openHistory()
  const rows = d
    .prepare(
      'SELECT text, created_at AS createdAt, duration_ms AS durationMs, fillers_removed AS fillers, vocab_applied AS vocab FROM transcriptions ORDER BY id'
    )
    .all() as Array<{
    text: string
    createdAt: string
    durationMs: number | null
    fillers: number
    vocab: number
  }>

  const perDay = new Map<string, number>()
  const perHour = new Array<number>(24).fill(0)
  const perWeekday = new Array<number>(7).fill(0)
  const wordCounts = new Map<string, number>()
  const phraseCounts = new Map<string, number>()
  let words = 0
  let rateWords = 0
  let rateMs = 0
  let topWpm = 0
  let audioMs = 0
  let correctionsFillers = 0
  let correctionsVocab = 0

  for (const row of rows) {
    const count = row.text.trim().split(/\s+/).filter(Boolean).length
    words += count
    correctionsFillers += row.fillers
    correctionsVocab += row.vocab
    if (row.durationMs && row.durationMs > 0) {
      rateWords += count
      rateMs += row.durationMs
      audioMs += row.durationMs
    }
    if (row.durationMs && row.durationMs >= 5000) {
      topWpm = Math.max(topWpm, Math.round((count / row.durationMs) * 60000))
    }
    const when = new Date(row.createdAt)
    const day = dayKeyLocal(when)
    perDay.set(day, (perDay.get(day) ?? 0) + count)
    perHour[when.getHours()] += count
    perWeekday[(when.getDay() + 6) % 7] += count

    const toks = tokens(row.text)
    for (const w of toks) wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1)
    for (let n = 3; n <= 5; n++) {
      for (let i = 0; i + n <= toks.length; i++) {
        const phrase = toks.slice(i, i + n).join(' ')
        phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1)
      }
    }
  }

  const topWords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }))
  const topPhrases = [...phraseCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase, count]) => ({ phrase, count }))

  const days = [...perDay.keys()].sort()
  const daySet = new Set(days)
  const fmt = (d: Date) => dayKeyLocal(d)
  let streak = 0
  const cursor = new Date()
  if (!daySet.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (daySet.has(fmt(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  let longest = 0
  let run = 0
  let prev: Date | null = null
  for (const key of days) {
    const [y, m, day] = key.split('-').map(Number)
    const current = new Date(y, m - 1, day)
    if (prev && current.getTime() - prev.getTime() === 86400000) run += 1
    else run = 1
    longest = Math.max(longest, run)
    prev = current
  }

  return {
    dictations: rows.length,
    words,
    audioMinutes: Math.round((audioMs / 60000) * 10) / 10,
    avgWpm: rateMs > 0 ? Math.round((rateWords / rateMs) * 60000) : 0,
    topWpm,
    dayStreak: streak,
    longestStreak: longest,
    correctionsFillers,
    correctionsVocab,
    perDay: [...perDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-400)
      .map(([date, dayWords]) => ({ date, words: dayWords })),
    perHour,
    perWeekday,
    topWords,
    topPhrases
  }
}

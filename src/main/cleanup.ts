/**
 * Local transcript post-processing. Runs fully offline on the transcribed
 * text: filler-word removal, whitespace/punctuation repair, sentence
 * capitalization, and caller-supplied vocabulary replacements.
 * Limitations: filler list is English-centric; the standalone "I" rule
 * applies to English only; replacements are whole-word case-insensitive.
 */

const FILLERS = ['um', 'uh', 'er', 'ah', 'hmm', 'mhm', 'uhm']

function stripPunctuation(word: string): string {
  return word.replace(/^[.,!?;:'"()]+|[.,!?;:'"()]+$/g, '')
}

export interface CleanupResult {
  text: string
  fillersRemoved: number
}

export function cleanupWithStats(raw: string, language: string): CleanupResult {
  let text = raw.replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim()
  const before = text.split(' ').filter(Boolean).length
  text = text
    .split(' ')
    .filter((word) => !FILLERS.includes(stripPunctuation(word).toLowerCase()))
    .join(' ')
  const fillersRemoved = Math.max(0, before - text.split(' ').filter(Boolean).length)
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, prefix: string, letter: string) => prefix + letter.toUpperCase())
  if (language.toLowerCase().startsWith('en')) {
    text = text.replace(/\bi\b/g, 'I')
  }
  text = text.replace(/\s+/g, ' ').trim()
  return { text, fillersRemoved }
}

export function cleanupTranscript(raw: string, language: string): string {
  return cleanupWithStats(raw, language).text
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface VocabResult {
  text: string
  applied: number
}

export function applyVocabularyWithStats(
  text: string,
  vocabulary: Record<string, string>
): VocabResult {
  let out = text
  let applied = 0
  for (const [from, to] of Object.entries(vocabulary)) {
    const source = from.trim()
    if (!source || !to) continue
    const pattern = new RegExp(`\\b${escapeRegExp(source)}\\b`, 'gi')
    const matches = out.match(pattern)
    if (matches) applied += matches.length
    out = out.replace(pattern, to)
  }
  return { text: out, applied }
}

export function applyVocabulary(text: string, vocabulary: Record<string, string>): string {
  return applyVocabularyWithStats(text, vocabulary).text
}

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

export function cleanupTranscript(raw: string, language: string): string {
  let text = raw.replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim()
  text = text
    .split(' ')
    .filter((word) => !FILLERS.includes(stripPunctuation(word).toLowerCase()))
    .join(' ')
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, prefix: string, letter: string) => prefix + letter.toUpperCase())
  if (language.toLowerCase().startsWith('en')) {
    text = text.replace(/\bi\b/g, 'I')
  }
  return text.replace(/\s+/g, ' ').trim()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function applyVocabulary(text: string, vocabulary: Record<string, string>): string {
  let out = text
  for (const [from, to] of Object.entries(vocabulary)) {
    const source = from.trim()
    if (!source || !to) continue
    out = out.replace(new RegExp(`\\b${escapeRegExp(source)}\\b`, 'gi'), to)
  }
  return out
}

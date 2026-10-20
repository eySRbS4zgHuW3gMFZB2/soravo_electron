import { useMemo, useState } from 'react'
import type { RecState, SoravoSettings, TranscriptEntry } from '../soravo'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/pages/PageHero'
import { CopyIcon, SearchIcon, TrashIcon } from '@/components/pages/icons'
import { dayLabel, hotkeyKeys, timeHM, useStats } from './shared'

type DictationPageProps = {
  history: TranscriptEntry[]
  settings: SoravoSettings | null
  state: RecState
  lastText: string
  copiedId: number | null
  onCopy: (id: number, text: string) => void
  onDelete: (id: number) => void
  onToggle: () => void
  onOpenStyle: () => void
  onOpenDictionary: () => void
}

/**
 * The hub's home page.
 *
 * The structure comes from Wispr Flow's Dictation page: a greeting that spells
 * out the dictation shortcut, a wide banner, a dated transcript feed and a
 * right-hand rail of summary cards. The banner is a gradient rather than the
 * photograph Wispr ships - see hub.css.
 */
export default function DictationPage({
  history,
  settings,
  state,
  lastText,
  copiedId,
  onCopy,
  onDelete,
  onToggle,
  onOpenStyle,
  onOpenDictionary
}: DictationPageProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const stats = useStats(history)

  const keys = hotkeyKeys(settings?.hotkey ?? 'CommandOrControl+Alt+Space')

  const today = useMemo(() => {
    const label = dayLabel(new Date())
    const query = search.trim().toLowerCase()
    return history
      .filter((h) => dayLabel(new Date(h.createdAt)) === label)
      .filter((h) => (query ? h.text.toLowerCase().includes(query) : true))
  }, [history, search])

  const statusLine =
    state === 'recording'
      ? 'Listening - press the hotkey again to finish'
      : state === 'transcribing'
        ? 'Transcribing locally...'
        : state === 'error'
          ? 'Something went wrong - try again'
          : lastText
            ? lastText
            : 'Press the button or hotkey and start talking'

  const challengeGoal = 100
  const challengePct = Math.min(100, Math.round((stats.todayWords / challengeGoal) * 100))
  const vocabCount = Object.keys(settings?.vocabulary ?? {}).length

  return (
    <div className="page">
      <h1 className="page-greeting">
        <span>Get into the flow with</span>
        <span className="hub-hotkey">
          {keys.map((key, index) => (
            <span key={`${key}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {index > 0 ? <span className="hub-hotkey-plus">+</span> : null}
              <span className="hub-hotkey-key">{key}</span>
            </span>
          ))}
        </span>
      </h1>

      <div className="page-scroll">
        <div className="page-column">
          <div className="dictation-grid">
            <div className="dictation-main">
              <PageHero
                media="flow"
                title={
                  <>
                    Make Soravo sound like <em>you</em>
                  </>
                }
                description="Set up your writing style, your vocabulary and your snippets, so every dictation lands exactly how you would have written it."
                cta={
                  <>
                    <Button onClick={onOpenStyle}>Start now</Button>
                    <Button onClick={onOpenDictionary}>Open dictionary</Button>
                  </>
                }
              />

              <div className="dictation-day">
                <span className="dictation-day-label">{dayLabel(new Date())}</span>
                <div className="page-utils">
                  {searchOpen ? (
                    <input
                      className="page-search-field"
                      style={{ maxWidth: 260, padding: '6px 12px' }}
                      placeholder="Search today's dictations"
                      value={search}
                      autoFocus
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setSearch('')
                          setSearchOpen(false)
                        }
                      }}
                      aria-label="Search today's dictations"
                    />
                  ) : (
                    <button
                      type="button"
                      className="page-icon-button"
                      title="Search today's dictations"
                      aria-label="Search today's dictations"
                      onClick={() => setSearchOpen(true)}
                    >
                      <SearchIcon size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="dictation-live">{statusLine}</div>

              {today.length === 0 ? (
                <div className="page-empty">
                  <p className="page-empty-title">
                    {search.trim() ? 'No results found' : 'Nothing dictated yet today'}
                  </p>
                  <p className="page-empty-body">
                    {search.trim()
                      ? 'No dictation from today matches that search.'
                      : 'Press the hotkey, say something, and it lands here.'}
                  </p>
                  {!search.trim() ? <Button onClick={onToggle}>Dictate now</Button> : null}
                </div>
              ) : (
                <div className="dictation-feed">
                  {today.map((entry) => (
                    <div className="dictation-row" key={entry.id}>
                      <span className="dictation-row-time">{timeHM(entry.createdAt)}</span>
                      <p className="dictation-row-text">{entry.text}</p>
                      <div className="dictation-row-actions">
                        <button
                          type="button"
                          className="page-icon-button"
                          title="Copy text"
                          aria-label="Copy text"
                          onClick={() => onCopy(entry.id, entry.text)}
                        >
                          {copiedId === entry.id ? <span className="page-badge">Copied</span> : <CopyIcon size={15} />}
                        </button>
                        <button
                          type="button"
                          className="page-icon-button"
                          title="Delete"
                          aria-label="Delete dictation"
                          onClick={() => onDelete(entry.id)}
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <aside className="dictation-rail">
              <div className="rail-card">
                <div className="rail-stats">
                  <div className="rail-stat">
                    <span className="rail-stat-value">{stats.words}</span>
                    <span className="rail-stat-label">total words</span>
                  </div>
                  <div className="rail-stat">
                    <span className="rail-stat-value">{stats.wpm}</span>
                    <span className="rail-stat-label">wpm</span>
                  </div>
                  <div className="rail-stat">
                    <span className="rail-stat-value">{stats.streak}</span>
                    <span className="rail-stat-label">day streak</span>
                  </div>
                </div>
              </div>

              <div className="rail-card">
                <p className="rail-card-title">Your Voice Profile</p>
                <p className="rail-card-body">
                  {vocabCount > 0
                    ? `${vocabCount} phrase${vocabCount === 1 ? '' : 's'} in your dictionary.`
                    : 'Add the words you say often so they are always spelled your way.'}
                </p>
                <div className="rail-progress">
                  <div
                    className="rail-progress-fill"
                    style={{ width: `${Math.min(100, (vocabCount / 20) * 100)}%` }}
                  />
                </div>
                <div className="rail-progress-meta">
                  <span>{vocabCount} phrases</span>
                  <span>{settings?.model ?? 'no model'}</span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Button variant="secondary" onClick={onOpenDictionary}>
                    Open dictionary
                  </Button>
                </div>
              </div>

              <div className="rail-card">
                <p className="rail-card-title">100 Words a Day Challenge</p>
                <p className="rail-card-body">Say a hundred words today.</p>
                <div className="rail-progress">
                  <div className="rail-progress-fill" style={{ width: `${challengePct}%` }} />
                </div>
                <div className="rail-progress-meta">
                  <span>
                    {stats.todayWords} / {challengeGoal} words
                  </span>
                  <span>
                    {stats.todayCount} dictation{stats.todayCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

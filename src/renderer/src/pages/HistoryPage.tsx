import { useMemo, useState } from 'react'
import type { TranscriptEntry } from '../soravo'
import { Button } from '@/components/ui/button'
import { CopyIcon, SearchIcon, TrashIcon } from '@/components/pages/icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'
import { groupByDay, timeHM } from './shared'

type HistoryPageProps = {
  history: TranscriptEntry[]
  copiedId: number | null
  onCopy: (id: number, text: string) => void
  onDelete: (id: number) => void
  onClear: () => void
  onRefresh: () => void
}

/**
 * The full transcript archive.
 *
 * Wispr Flow has no separate history page - its Dictation page carries the
 * feed - so this page borrows the same feed treatment: a dated eyebrow above
 * each group and a card of rows.
 */
export default function HistoryPage({
  history,
  copiedId,
  onCopy,
  onDelete,
  onClear,
  onRefresh
}: HistoryPageProps) {
  const [search, setSearch] = useState('')
  const [clearOpen, setClearOpen] = useState(false)

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = query
      ? history.filter((h) => h.text.toLowerCase().includes(query))
      : history
    return groupByDay(filtered)
  }, [history, search])

  const total = groups.reduce((sum, group) => sum + group.entries.length, 0)

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-head-title">History</h1>
        <div className="page-head-actions">
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
          {history.length > 0 ? (
            <Button variant="destructive" size="sm" onClick={() => setClearOpen(true)}>
              Clear all
            </Button>
          ) : null}
        </div>
      </div>

      <div className="page-scroll">
        <div className="page-column">
          <div className="page-stack">
            <div className="page-search">
              <input
                className="page-search-field"
                placeholder="Search your dictations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearch('')
                }}
                aria-label="Search your dictations"
              />
              {search ? (
                <button
                  type="button"
                  className="page-icon-button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <SearchIcon size={16} />
                </button>
              ) : null}
            </div>

            {total === 0 ? (
              <div className="page-empty">
                <p className="page-empty-title">
                  {search.trim() ? 'No results found' : 'No dictations yet'}
                </p>
                <p className="page-empty-body">
                  {search.trim()
                    ? 'No dictation matches that search.'
                    : 'Everything you dictate is kept here, on this machine only.'}
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span className="dictation-day-label">{group.label}</span>
                  <div className="dictation-feed">
                    {group.entries.map((entry) => (
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
                            {copiedId === entry.id ? (
                              <span className="page-badge">Copied</span>
                            ) : (
                              <CopyIcon size={15} />
                            )}
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
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Clearing the whole history is destructive, so it asks first. */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="page-dialog-panel">
          <DialogTitle>Delete all transcripts</DialogTitle>
          <DialogDescription>
            {history.length} saved dictation{history.length === 1 ? '' : 's'} will be deleted. This cannot be
            undone.
          </DialogDescription>
          <div className="page-dialog">
            <div className="page-dialog-actions">
              <Button variant="ghost" onClick={() => setClearOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setClearOpen(false)
                  onClear()
                }}
              >
                Delete all
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

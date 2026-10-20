import { useMemo, useRef, useState } from 'react'
import type { SoravoSettings } from '../soravo'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/pages/PageHero'
import { DownloadIcon, PencilIcon, PlusIcon, RefreshIcon, SearchIcon, SortIcon, TrashIcon } from '@/components/pages/icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

type SortMode = 'newest' | 'alphabetical'

const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Newest first',
  alphabetical: 'Alphabetical (A-Z)'
}

const BANNER_EXAMPLES = [
  { id: 'sore-avo', from: 'sore avo', to: 'Soravo' },
  { id: 'ada', from: 'ada lovelace', to: 'Ada Lovelace' },
  { id: 'london', from: 'new york', to: 'New York' }
]

type DictionaryPageProps = {
  settings: SoravoSettings | null
  onSave: (patch: Partial<SoravoSettings>) => Promise<void>
  onRefresh: () => void
}

/**
 * The Dictionary page.
 *
 * Wispr Flow's Dictionary is the personal word list: a banner, a list of the
 * phrases you said and how they should be written. Soravo already keeps that
 * list - it is the custom vocabulary applied to every dictation - so this page
 * surfaces it instead of burying it in Settings.
 */
export default function DictionaryPage({ settings, onSave, onRefresh }: DictionaryPageProps) {
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical')
  const [addOpen, setAddOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [editingFrom, setEditingFrom] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const vocabulary = settings?.vocabulary ?? {}

  const entries = useMemo(() => {
    // Object key order is insertion order, so the newest entry is last.
    const list = Object.entries(vocabulary).map(([fromText, toText]) => ({ from: fromText, to: toText }))
    const query = search.trim().toLowerCase()
    const filtered = query
      ? list.filter((e) => e.from.toLowerCase().includes(query) || e.to.toLowerCase().includes(query))
      : list
    if (sortMode === 'alphabetical') {
      filtered.sort((a, b) => a.from.localeCompare(b.from))
    } else {
      filtered.sort((a, b) => b.from.localeCompare(a.from))
    }
    return filtered
  }, [vocabulary, search, sortMode])

  const openAdd = (preset?: { from: string; to: string }) => {
    setEditingFrom(null)
    setFrom(preset?.from ?? '')
    setTo(preset?.to ?? '')
    setError('')
    setAddOpen(true)
  }

  const openEdit = (entry: { from: string; to: string }) => {
    setEditingFrom(entry.from)
    setFrom(entry.from)
    setTo(entry.to)
    setError('')
    setAddOpen(true)
  }

  const handleAdd = async () => {
    const key = from.trim()
    const value = to.trim()
    if (!key || !value) {
      setError('Say the phrase as you speak it, and how it should be written.')
      return
    }
    setSaving(true)
    try {
      const next = { ...vocabulary }
      if (editingFrom !== null && editingFrom !== key) delete next[editingFrom]
      next[key] = value
      await onSave({ vocabulary: next })
      setAddOpen(false)
      setFrom('')
      setTo('')
      setEditingFrom(null)
    } catch (e) {
      console.error('Could not add to the dictionary', e)
      setError('Could not save that entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (key: string) => {
    const next = { ...vocabulary }
    delete next[key]
    try {
      await onSave({ vocabulary: next })
    } catch (e) {
      console.error('Could not remove the dictionary entry', e)
    }
  }

  const handleExport = () => {
    const payload = Object.entries(vocabulary).map(([fromText, toText]) => ({ phrase: fromText, expansion: toText }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'soravo-dictionary.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const rows: Array<[string, string]> = Array.isArray(parsed)
        ? parsed
        : Object.entries(parsed as Record<string, string>)
      const next = { ...vocabulary }
      for (const row of rows) {
        if (Array.isArray(row) && typeof row[0] === 'string' && typeof row[1] === 'string') {
          next[row[0]] = row[1]
        }
      }
      await onSave({ vocabulary: next })
    } catch (e) {
      console.error('Could not import the dictionary', e)
      setError('That file could not be read as a dictionary export.')
    }
  }

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 20)
  }

  return (
    <div className="page">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="page-head">
        <h1 className="page-head-title">Dictionary</h1>
        <div className="page-head-actions">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={entries.length === 0}>
            <DownloadIcon size={15} /> Export
          </Button>
          <Button onClick={() => openAdd()}>
            <PlusIcon size={15} /> Add new
          </Button>
        </div>
      </div>

      <div className="page-scroll">
        <div className="page-column">
          <div className="page-stack">
            <div className="page-tabs" style={{ borderBottom: 'none', justifyContent: 'flex-end' }}>
              <div className="page-utils">
                {searchOpen ? (
                  <input
                    ref={searchRef}
                    className="page-search-field"
                    style={{ maxWidth: 280 }}
                    placeholder="Search your dictionary"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearch('')
                        setSearchOpen(false)
                      }
                    }}
                    aria-label="Search your dictionary"
                  />
                ) : (
                  <button
                    type="button"
                    className="page-icon-button"
                    title="Search your dictionary"
                    aria-label="Search your dictionary"
                    onClick={openSearch}
                  >
                    <SearchIcon size={16} />
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="page-icon-button" title="Sort by" aria-label="Sort by">
                      <SortIcon size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel className="shortcut-section">Sort by</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => setSortMode('newest')}>
                      {SORT_LABELS.newest}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setSortMode('alphabetical')}>
                      {SORT_LABELS.alphabetical}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  type="button"
                  className="page-icon-button"
                  title="Refresh"
                  aria-label="Refresh"
                  onClick={() => {
                    setRefreshing(true)
                    onRefresh()
                    setTimeout(() => setRefreshing(false), 400)
                  }}
                >
                  <RefreshIcon size={16} className={refreshing ? 'animate-spin' : undefined} />
                </button>
              </div>
            </div>

            {bannerDismissed ? null : (
              <PageHero
                media="dictionary"
                onDismiss={() => setBannerDismissed(true)}
                title={
                  <>
                    Soravo spells the way <em>you</em> do.
                  </>
                }
                description="Correct a spelling once, or add it here manually, so your terms, company jargon or uncommon names are written right in every dictation."
                examples={BANNER_EXAMPLES.map((example) => (
                  <div
                    key={example.id}
                    className="page-hero-example"
                    role="button"
                    tabIndex={0}
                    onClick={() => openAdd(example)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openAdd(example)
                      }
                    }}
                  >
                    <span className="page-hero-example-tag">
                      <Button variant="secondary" tabIndex={-1}>
                        &ldquo;{example.from}&rdquo;
                      </Button>
                    </span>
                    <span className="page-hero-example-arrow">→</span>
                    <span className="page-hero-example-tag">
                      <Button variant="secondary" tabIndex={-1}>
                        {example.to}
                      </Button>
                    </span>
                  </div>
                ))}
                cta={
                  <Button onClick={() => openAdd()}>
                    Add new word
                  </Button>
                }
              />
            )}

            {entries.length === 0 ? (
              <div className="page-empty">
                <p className="page-empty-title">
                  {search.trim() ? 'No results found' : 'Your dictionary is empty'}
                </p>
                <p className="page-empty-body">
                  {search.trim()
                    ? 'No entry matches that search.'
                    : 'Add a phrase you say often and how it should be written. Soravo applies it to every dictation.'}
                </p>
                {search.trim() ? null : <Button onClick={() => openAdd()}>Add new word</Button>}
              </div>
            ) : (
              <div className="page-card">
                {entries.map((entry) => (
                  <div className="page-row" key={entry.from}>
                    <div className="page-row-text">
                      <span className="page-row-label">
                        {entry.from} <span className="page-row-label-muted">→ {entry.to}</span>
                      </span>
                    </div>
                    <div className="page-row-actions">
                      <button
                        type="button"
                        className="page-row-action"
                        title="Edit"
                        aria-label={`Edit ${entry.from}`}
                        onClick={() => openEdit(entry)}
                      >
                        <PencilIcon size={15} />
                      </button>
                      <button
                        type="button"
                        className="page-row-action page-row-action-danger"
                        title="Remove"
                        aria-label={`Remove ${entry.from}`}
                        onClick={() => void handleRemove(entry.from)}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="page-dialog-panel">
          <DialogTitle>{editingFrom !== null ? 'Edit dictionary entry' : 'Add to the dictionary'}</DialogTitle>
          <DialogDescription>
            Soravo swaps the phrase you said for the way you write it.
          </DialogDescription>
          <div className="page-dialog">
            <div className="page-dialog-fields">
              <input
                className="page-dialog-input"
                placeholder="e.g. sore avo"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="Phrase as you say it"
              />
              <span className="page-dialog-arrow">→</span>
              <input
                className="page-dialog-input"
                placeholder="e.g. Soravo"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="How it should be written"
              />
            </div>
            {error ? <p className="page-dialog-error">{error}</p> : null}
            <div className="page-dialog-actions">
              <Button variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? 'Saving…' : editingFrom !== null ? 'Save changes' : 'Add word'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

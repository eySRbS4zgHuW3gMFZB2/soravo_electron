import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CloseIcon,
  PencilIcon,
  RefreshIcon,
  SearchIcon,
  SortIcon,
  TrashIcon
} from '@/components/pages/icons'
import { PageHero } from '@/components/pages/PageHero'
import { PageTabs } from '@/components/pages/PageTabs'
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
import { soravo } from '../soravo'
import type { Snippet } from '../soravo'

type SortMode = 'newest' | 'oldest' | 'alphabetical'
type Scope = 'all' | 'personal'

type ImportItem = { phrase: string; expansion: string }

const BANNER_EXAMPLES = [
  { id: 'linkedin', trigger: 'my LinkedIn', expansion: 'https://www.linkedin.com/in/john-doe/' },
  { id: 'rewrite', trigger: 'rewrite prompt', expansion: 'Rewrite this to be more concise...' },
  { id: 'intro', trigger: 'intro email', expansion: 'Hey, would love to find some time to chat later...' }
]

const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  alphabetical: 'Alphabetical (A-Z)'
}

function highlight(text: string, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return text
  const index = text.toLowerCase().indexOf(q)
  if (index === -1) return text
  return (
    <>
      {text.slice(0, index)}
      <span className="page-match">{text.slice(index, index + q.length)}</span>
      {text.slice(index + q.length)}
    </>
  )
}

export default function SnippetsPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [scope, setScope] = useState<Scope>('all')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Snippet | null>(null)
  const [deleteIds, setDeleteIds] = useState<number[]>([])
  const [formPhrase, setFormPhrase] = useState('')
  const [formExpansion, setFormExpansion] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importItems, setImportItems] = useState<ImportItem[]>([])
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const loadSnippets = async () => {
    try {
      const list = await soravo.getSnippets()
      setSnippets(list)
    } catch (e) {
      console.error('Failed to load snippets', e)
    }
  }

  useEffect(() => {
    loadSnippets()
  }, [])

  const filtered = useMemo(() => {
    let list = [...snippets]
    // "Shared with team" is not part of this build, so every snippet here
    // belongs to the user. The Personal tab still filters, so it keeps
    // meaning if team snippets are added later.
    if (scope === 'personal') {
      list = list.filter((s) => !s.isAutoLearned)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) => s.phrase.toLowerCase().includes(q) || s.expansion.toLowerCase().includes(q)
      )
    }
    switch (sortMode) {
      case 'alphabetical':
        list.sort((a, b) => a.phrase.localeCompare(b.phrase))
        break
      case 'oldest':
        list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        break
      default:
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return list
  }, [snippets, search, sortMode, scope])

  const handleSelect = (id: number, e: React.MouseEvent) => {
    const next = new Set(selectedIds)
    if (e.shiftKey && selectedIds.size > 0) {
      // Range select
      const ids = filtered.map((s) => s.id)
      const last = [...selectedIds].pop()!
      const start = ids.indexOf(last)
      const end = ids.indexOf(id)
      if (start !== -1 && end !== -1) {
        const [lo, hi] = start < end ? [start, end] : [end, start]
        for (let i = lo; i <= hi; i++) next.add(ids[i])
      }
    } else if (e.ctrlKey || e.metaKey) {
      if (next.has(id)) next.delete(id)
      else next.add(id)
    } else {
      if (next.has(id) && next.size === 1) next.clear()
      else {
        next.clear()
        next.add(id)
      }
    }
    setSelectedIds(next)
  }

  const clearSelection = () => setSelectedIds(new Set())

  const openAdd = () => {
    setEditingSnippet(null)
    setFormPhrase('')
    setFormExpansion('')
    setFormError('')
    setIsAddOpen(true)
  }

  const openEdit = (snippet: Snippet) => {
    setEditingSnippet(snippet)
    setFormPhrase(snippet.phrase)
    setFormExpansion(snippet.expansion)
    setFormError('')
    setIsAddOpen(true)
  }

  const handleSave = async () => {
    const phrase = formPhrase.trim()
    const expansion = formExpansion.trim()
    if (!phrase || !expansion) {
      setFormError('Both a trigger and the text it expands to are required.')
      return
    }
    setSaving(true)
    try {
      if (editingSnippet) {
        await soravo.updateSnippet(editingSnippet.id, { phrase, expansion })
      } else {
        await soravo.addSnippet(phrase, expansion)
      }
      await loadSnippets()
      setIsAddOpen(false)
      setEditingSnippet(null)
    } catch (e) {
      console.error('Save failed', e)
      setFormError('Could not save the snippet. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (ids: number[]) => {
    try {
      for (const id of ids) {
        await soravo.deleteSnippet(id)
      }
      await loadSnippets()
      clearSelection()
      setIsDeleteOpen(false)
      setDeleteTarget(null)
      setDeleteIds([])
    } catch (e) {
      console.error('Delete failed', e)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadSnippets()
    setTimeout(() => setRefreshing(false), 400)
  }

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 20)
  }

  /**
   * Reads a snippets export. Wispr Flow imports a JSON file, so the same
   * shape is accepted here: an array of {phrase, expansion}, a
   * {snippets: [...]} object, or a {phrase: expansion} map.
   */
  const parseImport = (text: string): ImportItem[] => {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('That file is not valid JSON.')
    }
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { snippets?: unknown }).snippets)
        ? (parsed as { snippets: unknown[] }).snippets
        : parsed && typeof parsed === 'object'
          ? Object.entries(parsed as Record<string, string>).map(([phrase, expansion]) => ({ phrase, expansion }))
          : null
    if (!rows) throw new Error('That file does not contain any snippets.')
    const items: ImportItem[] = []
    for (const row of rows) {
      if (Array.isArray(row)) {
        const [phrase, expansion] = row
        if (typeof phrase === 'string' && typeof expansion === 'string') {
          items.push({ phrase: phrase.trim(), expansion: expansion.trim() })
        }
        continue
      }
      if (row && typeof row === 'object') {
        const record = row as Record<string, unknown>
        const phrase = record.phrase ?? record.snippet ?? record.trigger
        const expansion = record.expansion ?? record.replacement ?? record.text
        if (typeof phrase === 'string' && typeof expansion === 'string') {
          items.push({ phrase: phrase.trim(), expansion: expansion.trim() })
        }
      }
    }
    const usable = items.filter((i) => i.phrase && i.expansion)
    if (usable.length === 0) throw new Error('No snippets with a phrase and an expansion were found.')
    return usable
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const items = parseImport(await file.text())
      setImportItems(items)
      setImportError('')
      setImportOpen(true)
    } catch (e) {
      setImportItems([])
      setImportError(e instanceof Error ? e.message : 'Could not read that file.')
      setImportOpen(true)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      for (const item of importItems) {
        await soravo.addSnippet(item.phrase, item.expansion)
      }
      await loadSnippets()
      setImportOpen(false)
      setImportItems([])
    } catch (e) {
      console.error('Import failed', e)
      setImportError('Some snippets could not be imported.')
    } finally {
      setImporting(false)
    }
  }

  const selectedCount = selectedIds.size

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
        <h1 className="page-head-title">Snippets</h1>
        <div className="page-head-actions">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <Button onClick={openAdd}>Add new</Button>
        </div>
      </div>

      <PageTabs
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'personal', label: 'Personal' }
        ]}
        activeKey={scope}
        onChange={(key) => setScope(key as Scope)}
        utils={
          <>
            <button
              type="button"
              className="page-icon-button"
              title="Search snippets"
              aria-label="Search snippets"
              onClick={openSearch}
            >
              <SearchIcon size={16} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="page-icon-button"
                  title="Sort by"
                  aria-label="Sort by"
                >
                  <SortIcon size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel className="shortcut-section">Sort by</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setSortMode('newest')}>
                  {SORT_LABELS.newest}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortMode('oldest')}>
                  {SORT_LABELS.oldest}
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
              onClick={handleRefresh}
            >
              <RefreshIcon size={16} className={refreshing ? 'animate-spin' : undefined} />
            </button>
          </>
        }
      />

      {searchOpen ? (
        <div className="page-search">
          <input
            ref={searchRef}
            className="page-search-field"
            placeholder="Search your snippets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearch('')
                setSearchOpen(false)
              }
            }}
            aria-label="Search your snippets"
          />
          {search ? (
            <button
              type="button"
              className="page-icon-button"
              onClick={() => {
                setSearch('')
                setSearchOpen(false)
              }}
              aria-label="Clear search"
            >
              <CloseIcon size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="page-head-actions" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedCount} selected</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDeleteIds([...selectedIds])
              setDeleteTarget(null)
              setIsDeleteOpen(true)
            }}
          >
            <TrashIcon size={14} /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="page-scroll">
        <div className="page-column">
          <div className="page-stack">
            {bannerDismissed ? null : (
              <PageHero
                media="snippets"
                onDismiss={() => setBannerDismissed(true)}
                title={
                  <>
                    The stuff <em>you</em> shouldn&rsquo;t have to re-type.
                  </>
                }
                description="Save text you type often — an email, intro, or prompt — then say a word to drop it in instantly."
                examples={BANNER_EXAMPLES.map((example) => (
                  <div
                    key={example.id}
                    className="page-hero-example"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setFormPhrase(example.trigger)
                      setFormExpansion(example.expansion)
                      setEditingSnippet(null)
                      setFormError('')
                      setIsAddOpen(true)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setFormPhrase(example.trigger)
                        setFormExpansion(example.expansion)
                        setEditingSnippet(null)
                        setFormError('')
                        setIsAddOpen(true)
                      }
                    }}
                  >
                    <span className="page-hero-example-tag">
                      <Button variant="secondary" size="sm" tabIndex={-1}>
                        &ldquo;{example.trigger}&rdquo;
                      </Button>
                    </span>
                    <span className="page-hero-example-arrow">→</span>
                    <span className="page-hero-example-tag">
                      <Button variant="secondary" size="sm" tabIndex={-1}>
                        {example.expansion}
                      </Button>
                    </span>
                  </div>
                ))}
                cta={
                  <Button variant="default" onClick={openAdd}>
                    Add new snippet
                  </Button>
                }
              />
            )}

            {filtered.length === 0 ? (
              <div className="page-empty">
                <p className="page-empty-title">
                  {search.trim() ? 'No results found' : 'No snippets yet'}
                </p>
                <p className="page-empty-body">
                  {search.trim()
                    ? 'No snippets were found.'
                    : 'Save text you type often — an email, intro, or prompt — then say a word to drop it in instantly.'}
                </p>
                {search.trim() ? null : (
                  <Button variant="secondary" onClick={openAdd}>
                    Add new snippet
                  </Button>
                )}
              </div>
            ) : (
              <div className="page-card">
                {filtered.map((snippet) => (
                  <div
                    key={snippet.id}
                    className={cn('page-row', selectedIds.has(snippet.id) && 'page-row-selected')}
                    onClick={(e) => handleSelect(snippet.id, e)}
                  >
                    <div className="page-row-text">
                      <span className="page-row-label">
                        {highlight(snippet.phrase, search)}
                        {' → '}
                        <span className="page-row-label-muted">
                          {highlight(snippet.expansion, search)}
                        </span>
                      </span>
                      {snippet.isAutoLearned ? (
                        <span className="page-badge page-badge-muted" title="Auto-learned">
                          Auto-learned
                        </span>
                      ) : null}
                    </div>
                    <div className="page-row-actions">
                      <button
                        type="button"
                        className="page-row-action"
                        title="Edit"
                        aria-label={`Edit ${snippet.phrase}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(snippet)
                        }}
                      >
                        <PencilIcon size={15} />
                      </button>
                      <button
                        type="button"
                        className="page-row-action page-row-action-danger"
                        title="Delete"
                        aria-label={`Delete ${snippet.phrase}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(snippet)
                          setDeleteIds([snippet.id])
                          setIsDeleteOpen(true)
                        }}
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

      {/* Add / Edit */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="page-dialog-panel">
          <DialogTitle>{editingSnippet ? 'Edit snippet' : 'Add snippet'}</DialogTitle>
          <DialogDescription>
            Say the trigger word and Soravo drops the text in for you.
          </DialogDescription>
          <div className="page-dialog">
            <div className="page-dialog-fields">
              <input
                className="page-dialog-input"
                placeholder="e.g. my email"
                value={formPhrase}
                onChange={(e) => setFormPhrase(e.target.value)}
                aria-label="Trigger phrase"
              />
              <span className="page-dialog-arrow">→</span>
              <input
                className="page-dialog-input"
                placeholder="e.g. ada@example.com"
                value={formExpansion}
                onChange={(e) => setFormExpansion(e.target.value)}
                aria-label="Expansion text"
              />
            </div>
            {formError ? <p className="page-dialog-error">{formError}</p> : null}
            <div className="page-dialog-actions">
              <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingSnippet ? 'Save changes' : 'Add snippet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import preview */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="page-dialog-panel">
          <DialogTitle>Import snippets</DialogTitle>
          <DialogDescription>
            {importError
              ? 'That file could not be read.'
              : `${importItems.length} snippet${importItems.length === 1 ? '' : 's'} ready to import.`}
          </DialogDescription>
          <div className="page-dialog">
            {importError ? (
              <p className="page-dialog-error">{importError}</p>
            ) : (
              <div className="page-import-list">
                {importItems.slice(0, 50).map((item, index) => (
                  <div className="page-import-row" key={`${item.phrase}-${index}`}>
                    <span className="page-import-phrase">{item.phrase}</span>
                    <span className="page-import-arrow">→</span>
                    <span className="page-import-expansion">{item.expansion}</span>
                  </div>
                ))}
                {importItems.length > 50 ? (
                  <p className="page-import-more">and {importItems.length - 50} more…</p>
                ) : null}
              </div>
            )}
            <div className="page-dialog-actions">
              <Button variant="ghost" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              {importError ? (
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Choose another file
                </Button>
              ) : (
                <Button onClick={handleImport} disabled={importing}>
                  {importing
                    ? 'Importing…'
                    : `Import ${importItems.length} snippet${importItems.length === 1 ? '' : 's'}`}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="page-dialog-panel">
          <DialogTitle>
            {deleteIds.length > 1 ? `Delete ${deleteIds.length} snippets` : 'Delete snippet'}
          </DialogTitle>
          <DialogDescription>
            {deleteIds.length > 1
              ? 'Are you sure you want to delete these snippets? This cannot be undone.'
              : `Are you sure you want to delete “${deleteTarget?.phrase ?? ''}”? This cannot be undone.`}
          </DialogDescription>
          <div className="page-dialog">
            <div className="page-dialog-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsDeleteOpen(false)
                  setDeleteTarget(null)
                  setDeleteIds([])
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteIds)}>
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

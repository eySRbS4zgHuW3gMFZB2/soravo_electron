import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  CopyIcon,
  ScratchpadIcon,
  TrashIcon,
} from '@/components/icons'
import {
  Dialog,
  DialogContent,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { soravo } from './soravo'
import type { Snippet } from './soravo'

type SortMode = 'newest' | 'oldest' | 'alphabetical'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SnippetsPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Snippet | null>(null)
  const [deleteIds, setDeleteIds] = useState<number[]>([])
  const [formPhrase, setFormPhrase] = useState('')
  const [formExpansion, setFormExpansion] = useState('')
  const [saving, setSaving] = useState(false)

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
  }, [snippets, search, sortMode])

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
    setFormPhrase('')
    setFormExpansion('')
    setIsAddOpen(true)
  }

  const openEdit = (snippet: Snippet) => {
    setEditingSnippet(snippet)
    setFormPhrase(snippet.phrase)
    setFormExpansion(snippet.expansion)
    setIsAddOpen(true)
  }

  const handleSave = async () => {
    if (!formPhrase.trim() || !formExpansion.trim()) return
    setSaving(true)
    try {
      if (editingSnippet) {
        await soravo.updateSnippet(editingSnippet.id, {
          phrase: formPhrase.trim(),
          expansion: formExpansion.trim(),
        })
      } else {
        await soravo.addSnippet(formPhrase.trim(), formExpansion.trim())
      }
      await loadSnippets()
      setIsAddOpen(false)
      setEditingSnippet(null)
    } catch (e) {
      console.error('Save failed', e)
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

  const handleCopy = async (expansion: string) => {
    await navigator.clipboard.writeText(expansion)
  }

  const selectedCount = selectedIds.size
  const allSelected = selectedCount > 0 && selectedCount === filtered.length

  return (
    <div className="snippets-page">
      <div className="snippets-header">
        <h2 className="snippets-title">Snippets</h2>
        <Button variant="default" size="sm" onClick={openAdd}>
          + New Snippet
        </Button>
      </div>

      <div className="snippets-toolbar">
        <div className="snippets-search">
          <Input
            placeholder="Search snippets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="snippets-search-input"
          />
        </div>
        <div className="snippets-sort">
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="snippets-sort-trigger">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="snippets-bulk-bar">
          <span>{selectedCount} selected</span>
          <Button variant="ghost" size="sm" onClick={() => handleDelete([...selectedIds])}>
            <TrashIcon /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      <div className="snippets-list">
        {filtered.length === 0 && search.trim() && (
          <div className="snippets-empty">
            <p className="snippets-empty-title">No results</p>
            <p className="snippets-empty-body">
              No snippets match "{search}". Try a different search term.
            </p>
          </div>
        )}
        {filtered.length === 0 && !search.trim() && (
          <div className="snippets-empty">
            <ScratchpadIcon />
            <p className="snippets-empty-title">No snippets yet</p>
            <p className="snippets-empty-body">
              Create snippets for things you type all the time — emails, links, addresses, bios.
            </p>
            <Button variant="default" size="sm" onClick={openAdd}>
              + New Snippet
            </Button>
          </div>
        )}
        {filtered.map((snippet) => (
          <div
            key={snippet.id}
            className={cn(
              'snippets-item',
              selectedIds.has(snippet.id) && 'selected'
            )}
            onClick={(e) => handleSelect(snippet.id, e)}
          >
            <div className="snippets-item-main">
              <div className="snippets-item-phrase">
                {snippet.phrase}
                {snippet.isAutoLearned && (
                  <span className="snippets-auto-learned">Auto-learned</span>
                )}
              </div>
              <div className="snippets-item-expansion">
                {snippet.expansion.length > 80
                  ? snippet.expansion.slice(0, 80) + '...'
                  : snippet.expansion}
              </div>
              <div className="snippets-item-date">{fmtDate(snippet.createdAt)}</div>
            </div>
            <div className="snippets-item-actions">
              <Button
                variant="ghost"
                size="sm"
                className="snippets-action"
                onClick={(e) => { e.stopPropagation(); openEdit(snippet) }}
                title="Edit"
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="snippets-action"
                onClick={(e) => { e.stopPropagation(); handleCopy(snippet.expansion) }}
                title="Copy"
              >
                <CopyIcon />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="snippets-action"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(snippet)
                  setDeleteIds([snippet.id])
                  setIsDeleteOpen(true)
                }}
                title="Delete"
              >
                <TrashIcon />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogTitle>{editingSnippet ? 'Edit Snippet' : 'New Snippet'}</DialogTitle>
          <div className="snippets-form">
            <label className="snippets-form-label">
              Phrase
              <Input
                placeholder="e.g., my email"
                value={formPhrase}
                onChange={(e) => setFormPhrase(e.target.value)}
              />
            </label>
            <label className="snippets-form-label">
              Expansion
              <textarea
                className="snippets-form-textarea"
                placeholder="The text to expand to..."
                value={formExpansion}
                onChange={(e) => setFormExpansion(e.target.value)}
                rows={4}
              />
            </label>
            <div className="snippets-form-actions">
              <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={!formPhrase.trim() || !formExpansion.trim() || saving}
              >
                {saving ? 'Saving...' : editingSnippet ? 'Save Changes' : 'Add Snippet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogTitle>Delete {deleteIds.length > 1 ? `${deleteIds.length} Snippets` : 'Snippet'}</DialogTitle>
          <div className="snippets-form">
            <p className="snippets-delete-body">
              {deleteIds.length > 1
                ? `Are you sure you want to delete ${deleteIds.length} snippets? This cannot be undone.`
                : `Are you sure you want to delete "${deleteTarget?.phrase}"? This cannot be undone.`}
            </p>
            <div className="snippets-form-actions">
              <Button variant="ghost" onClick={() => { setIsDeleteOpen(false); setDeleteTarget(null); setDeleteIds([]) }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteIds)}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import HotkeyCapture, { prettyHotkey } from '../HotkeyCapture'
import {
  CloseIcon,
  CopyIcon,
  PinIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
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
import { soravo } from '../soravo'
import type { ScratchpadNote } from '../soravo'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

function noteTitle(text: string): string {
  const firstLine = text.split('\n').find((line) => line.trim().length > 0) ?? ''
  return firstLine.trim() || 'Untitled'
}

/**
 * The body of a note, without the line that is already shown as its title.
 * Without this the card repeated the same sentence twice.
 */
function noteBody(text: string): string {
  const lines = text.split('\n')
  const first = lines.findIndex((line) => line.trim().length > 0)
  if (first === -1) return ''
  return lines
    .slice(first + 1)
    .join(' ')
    .trim()
}

export default function ScratchpadPage() {
  const [notes, setNotes] = useState<ScratchpadNote[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [hotkey, setHotkey] = useState('CommandOrControl+Alt+Space')
  const [textareaFocused, setTextareaFocused] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [scratchpadHotkey, setScratchpadHotkey] = useState('')
  const [shortcutOpen, setShortcutOpen] = useState(false)
  // Track if the current recording was initiated from this page
  const recordingFromScratchpad = useRef(false)
  const lastProcessedRecording = useRef(0)
  const recordingCounter = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // The active note is mirrored in a ref. `loadNotes` is registered as the
  // scratchpad-changed listener, and that event fires after every add, edit
  // and delete - including the autosave triggered by the editor losing
  // focus. Reading the id from state there would capture a stale value and
  // could move the selection or overwrite the draft mid-edit.
  const activeIdRef = useRef<number | null>(null)

  const selectNote = (id: number | null, text = '') => {
    activeIdRef.current = id
    setActiveId(id)
    setDraft(text)
  }

  const loadNotes = async () => {
    try {
      const list = await soravo.getScratchpadNotes()
      setNotes(list)
      const current = activeIdRef.current
      if (list.length === 0) {
        selectNote(null)
        return
      }
      if (current === null || !list.some((n) => n.id === current)) {
        // Nothing is selected yet, or the selected note was removed
        // elsewhere. Either way, fall back to the first note.
        selectNote(list[0].id, list[0].text)
      }
    } catch (e) {
      console.error('Failed to load scratchpad notes', e)
    }
  }

  const isHotkeyMatch = (e: { key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }) => {
    const parts = hotkey.toLowerCase().split('+')
    const needsCtrl = parts.includes('commandorcontrol') || parts.includes('ctrl') || parts.includes('control')
    const needsAlt = parts.includes('alt')
    const needsShift = parts.includes('shift')
    const triggerKey = parts.filter((p) => !['commandorcontrol', 'ctrl', 'control', 'alt', 'shift', 'meta', 'super'].includes(p))[0]

    return (
      (needsCtrl === (e.ctrlKey || e.metaKey)) &&
      (needsAlt === e.altKey) &&
      (needsShift === e.shiftKey) &&
      !!triggerKey &&
      e.key.toLowerCase() === triggerKey
    )
  }

  useEffect(() => {
    loadNotes()
    soravo.getSettings().then((s) => {
      setHotkey(s.hotkey)
      setScratchpadHotkey(s.scratchpadHotkey ?? '')
    }).catch(() => {})
    const off = soravo.onScratchpadChanged(() => {
      loadNotes()
    })
    // Append transcript text if recording was initiated from this page.
    // Reset the flag after a short delay to prevent transcript leak
    // while ensuring the transcript has time to arrive.
    const offTranscript = soravo.onTranscript((text) => {
      if (recordingFromScratchpad.current && recordingCounter.current > lastProcessedRecording.current) {
        setDraft((prev) => (prev ? prev + ' ' + text : text))
        lastProcessedRecording.current = recordingCounter.current
      }
    })
    return () => {
      off()
      offTranscript()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When textarea is focused, disable global hook
  useEffect(() => {
    soravo.setTextareaFocus(textareaFocused).catch(() => {})
  }, [textareaFocused])

  // Reset recording flag when window loses focus (prevents transcript leak
  // when user switches to another app while scratchpad is active)
  useEffect(() => {
    const handleWindowBlur = () => {
      recordingFromScratchpad.current = false
    }
    window.addEventListener('blur', handleWindowBlur)
    return () => window.removeEventListener('blur', handleWindowBlur)
  }, [])

  // keydown: start recording (only when textarea focused, global hook disabled)
  useEffect(() => {
    const keyDownHandler = (e: KeyboardEvent) => {
      if (!textareaFocused) return
      if (e.repeat) return
      if (!isHotkeyMatch(e)) return
      e.preventDefault()
      e.stopPropagation()
      recordingFromScratchpad.current = true
      recordingCounter.current += 1
      soravo.toggle().catch(console.error)
    }
    window.addEventListener('keydown', keyDownHandler)
    return () => window.removeEventListener('keydown', keyDownHandler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textareaFocused, hotkey])

  const activeNote = notes.find((n) => n.id === activeId) ?? null

  const visibleNotes = useMemo(() => {
    if (!search.trim()) return notes
    const q = search.toLowerCase()
    return notes.filter((n) => n.text.toLowerCase().includes(q))
  }, [notes, search])

  const handleNew = async () => {
    if (draft.trim() && activeId !== null) {
      await soravo.updateScratchpadNote(activeId, { text: draft })
    }
    const note = await soravo.addScratchpadNote('')
    setNotes((prev) => [note, ...prev])
    selectNote(note.id)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleSave = async () => {
    if (activeId === null) return
    setSaving(true)
    try {
      await soravo.updateScratchpadNote(activeId, { text: draft })
    } catch (e) {
      console.error('Save failed', e)
    } finally {
      setSaving(false)
    }
  }

  const handlePin = async (id: number) => {
    const note = notes.find((n) => n.id === id)
    if (!note) return
    await soravo.updateScratchpadNote(id, { pinned: !note.pinned })
  }

  const handleDelete = async (id: number) => {
    await soravo.deleteScratchpadNote(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (activeId === id) {
      const remaining = notes.filter((n) => n.id !== id)
      if (remaining.length > 0) {
        selectNote(remaining[0].id, remaining[0].text)
      } else {
        selectNote(null)
      }
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft)
  }

  const handleSelect = (note: ScratchpadNote) => {
    if (activeId !== null && draft !== activeNote?.text) {
      soravo.updateScratchpadNote(activeId, { text: draft }).catch(console.error)
    }
    selectNote(note.id, note.text)
  }

  const handleBlur = () => {
    if (activeId !== null) {
      soravo.updateScratchpadNote(activeId, { text: draft }).catch(console.error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadNotes()
    setTimeout(() => setRefreshing(false), 400)
  }

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 20)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-head-title">
          Scratchpad{' '}
          <span className="page-badge" style={{ verticalAlign: 'middle' }}>
            Beta
          </span>
        </h1>
        <div className="page-head-actions">
          <Button variant="secondary" onClick={() => setShortcutOpen(true)}>
            {scratchpadHotkey ? prettyHotkey(scratchpadHotkey) : 'Click to enable shortcut'}
          </Button>
        </div>
      </div>

      <div className="page-scroll">
        <div className="page-column">
          <div className="page-stack">
            <PageHero
              media="scratchpad"
              title={<>For quick thoughts you want to come back to</>}
              description="Drop a to-do list, polish a message before you send it, brain dump an idea. Scratchpad is your safe space to save, create, and explore."
              cta={
                <Button variant="default" onClick={handleNew}>
                  Start new note
                </Button>
              }
              overlay={
                <div className="page-hero-mockup" aria-hidden="true">
                  <div className="page-hero-mockup-top">
                    <span className="page-hero-mockup-title">Untitled</span>
                    <span className="page-hero-mockup-title">Scratchpad</span>
                  </div>
                  <div className="page-hero-mockup-body">
                    <div className="page-hero-mockup-rail">
                      <span className="page-hero-mockup-dot" />
                      <span className="page-hero-mockup-dot" />
                      <span className="page-hero-mockup-dot" />
                    </div>
                    <p className="page-hero-mockup-text">
                      The core principle is about agency and stakes. A progress bar says you have a
                      shrinking window to do something.
                    </p>
                  </div>
                </div>
              }
            />

            <PageTabs
              tabs={[{ key: 'recents', label: 'Recents' }]}
              activeKey="recents"
              onChange={() => {}}
              sticky
              utils={
                <>
                  <button
                    type="button"
                    className="page-icon-button"
                    title="Search your notes"
                    aria-label="Search your notes"
                    onClick={openSearch}
                  >
                    <SearchIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className="page-icon-button"
                    title="New note"
                    aria-label="New note"
                    onClick={handleNew}
                  >
                    <PlusIcon size={16} />
                  </button>
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
                  placeholder="Search your notes"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearch('')
                      setSearchOpen(false)
                    }
                  }}
                  aria-label="Search your notes"
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

            <div className="page-note-list">
              {visibleNotes.length === 0 ? (
                <div className="page-empty-flat">
                  {search.trim() ? 'No matching notes' : 'No notes found'}
                </div>
              ) : (
                visibleNotes.map((note) => (
                  <div
                    key={note.id}
                    id={`note-card-${note.id}`}
                    data-note-id={note.id}
                    className={cn('page-note', activeId === note.id && 'page-note-active')}
                    role="option"
                    aria-selected={activeId === note.id}
                    onClick={() => handleSelect(note)}
                  >
                    {note.pinned ? (
                      <div className="page-note-pin">
                        <span title="Pinned">
                          <PinIcon size={14} />
                        </span>
                      </div>
                    ) : null}
                    <div className="page-note-body">
                      <div className="page-note-title">{noteTitle(note.text)}</div>
                      {noteBody(note.text) ? (
                        <div className="page-note-preview">{noteBody(note.text)}</div>
                      ) : null}
                      <div className="page-note-footer">
                        <span>{fmtDate(note.createdAt)}</span>
                      </div>
                    </div>
                    <div className="page-note-actions">
                      <button
                        type="button"
                        className="page-note-action"
                        title={note.pinned ? 'Unpin note' : 'Pin note'}
                        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handlePin(note.id)
                        }}
                      >
                        <PinIcon size={15} />
                      </button>
                      <button
                        type="button"
                        className="page-note-action"
                        title="Copy note"
                        aria-label="Copy note"
                        onClick={(e) => {
                          e.stopPropagation()
                          void navigator.clipboard.writeText(note.text)
                        }}
                      >
                        <CopyIcon size={15} />
                      </button>
                      <button
                        type="button"
                        className="page-note-action"
                        title="Delete note"
                        aria-label="Delete note"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDelete(note.id)
                        }}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* The editor stays inline so dictation keeps working from this tab. */}
            {activeNote ? (
              <div className="page-editor">
                <div className="page-editor-toolbar">
                  <Button variant="secondary" onClick={handleNew}>
                    <PlusIcon size={14} /> New note
                  </Button>
                  <Button variant="ghost" onClick={() => void handlePin(activeNote.id)}>
                    <PinIcon size={14} /> {activeNote.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button variant="ghost" onClick={handleCopy}>
                    <CopyIcon size={14} /> Copy
                  </Button>
                  <Button variant="ghost" onClick={() => void handleDelete(activeNote.id)}>
                    <TrashIcon size={14} /> Delete
                  </Button>
                  <span className="page-editor-status">{saving ? 'Saving…' : ''}</span>
                </div>
                <textarea
                  ref={textareaRef}
                  className="page-editor-field"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onFocus={() => setTextareaFocused(true)}
                  onBlur={(e) => {
                    setTextareaFocused(false)
                    handleBlur()
                  }}
                  placeholder="Start typing or dictate…"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Scratchpad shortcut */}
      <Dialog open={shortcutOpen} onOpenChange={setShortcutOpen}>
        <DialogContent className="page-dialog-panel">
          <DialogTitle>Open Scratchpad</DialogTitle>
          <DialogDescription>
            Press to open the Scratchpad tab from anywhere in the hub.
          </DialogDescription>
          <div className="page-dialog">
            <HotkeyCapture
              value={scratchpadHotkey}
              allowEmpty
              onCommit={(accelerator) => {
                setScratchpadHotkey(accelerator)
                soravo
                  .setSettings({ scratchpadHotkey: accelerator })
                  .catch(console.error)
                setShortcutOpen(false)
              }}
            />
            <div className="page-dialog-actions">
              <Button variant="ghost" onClick={() => setShortcutOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

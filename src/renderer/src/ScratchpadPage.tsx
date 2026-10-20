import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import HotkeyCapture, { prettyHotkey } from './HotkeyCapture'
import {
  CloseIcon,
  CopyIcon,
  InfoIcon,
  PinIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon
} from '@/components/wispr/icons'
import { WisprBanner } from '@/components/wispr/WisprBanner'
import { WisprTabs } from '@/components/wispr/WisprTabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'
import { soravo } from './soravo'
import type { ScratchpadNote } from './soravo'

const BANNER_IMAGE = '/images/wispr-banner-scratchpad.png'

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

export default function ScratchpadPage() {
  const [notes, setNotes] = useState<ScratchpadNote[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [hotkey, setHotkey] = useState('CommandOrControl+Alt+Space')
  const [textareaFocused, setTextareaFocused] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [showFlowBar, setShowFlowBar] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [scratchpadHotkey, setScratchpadHotkey] = useState('')
  const [shortcutOpen, setShortcutOpen] = useState(false)
  // Track if the current recording was initiated from this page
  const recordingFromScratchpad = useRef(false)
  const lastProcessedRecording = useRef(0)
  const recordingCounter = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const loadNotes = async () => {
    try {
      const list = await soravo.getScratchpadNotes()
      setNotes(list)
      if (list.length > 0 && activeId === null) {
        setActiveId(list[0].id)
        setDraft(list[0].text)
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
    setActiveId(note.id)
    setDraft('')
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
        setActiveId(remaining[0].id)
        setDraft(remaining[0].text)
      } else {
        setActiveId(null)
        setDraft('')
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
    setActiveId(note.id)
    setDraft(note.text)
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
    <div className="wispr-page">
      <div className="wispr-page-top">
        <div className="wispr-page-title">
          <div className="wispr-page-title-row">
            <h1>
              <span className="wispr-title-with-badge">
                Scratchpad
                <span className="wispr-beta-badge">Beta</span>
              </span>
            </h1>
            <div className="wispr-page-cta">
              <span className="wispr-pill-row">
                <span className="wispr-toggle-label">Add to Flow Bar</span>
                <span
                  title="Show a Scratchpad button on the flow bar so you can open notes from anywhere."
                  style={{ display: 'inline-flex' }}
                >
                  <InfoIcon size={14} />
                </span>
                <Switch
                  checked={showFlowBar}
                  onCheckedChange={(c) => setShowFlowBar(c === true)}
                  aria-label="Add to Flow Bar"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="wispr-shortcut-pill"
                  onClick={() => setShortcutOpen(true)}
                  title="Change the Scratchpad shortcut"
                >
                  {scratchpadHotkey ? prettyHotkey(scratchpadHotkey) : 'Click to enable shortcut'}
                </Button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="wispr-page-scroll">
        <div className="wispr-page-content">
          <WisprBanner
            image={BANNER_IMAGE}
            title={<>For quick thoughts you want to come back to</>}
            description="Drop a to-do list, polish a message before you send it, brain dump an idea. Scratchpad is your safe space to save, create, and explore."
            cta={
              <Button variant="secondary" onClick={handleNew}>
                Start new note
              </Button>
            }
            overlay={
              <div className="wispr-banner-mockup" aria-hidden="true">
                <div className="wispr-banner-mockup-top">
                  <div className="wispr-banner-mockup-top-left">
                    <span className="wispr-banner-mockup-ghost">×</span>
                    <span className="wispr-banner-mockup-ghost">◫</span>
                    <span className="wispr-banner-mockup-tab">
                      <span className="wispr-banner-mockup-tab-label">Untitled</span>
                      <span className="wispr-banner-mockup-ghost">×</span>
                    </span>
                    <span className="wispr-banner-mockup-ghost">+</span>
                  </div>
                  <span className="wispr-banner-mockup-ghost">⤢</span>
                </div>
                <div className="wispr-banner-mockup-body">
                  <div className="wispr-banner-mockup-sidebar">
                    <span className="wispr-banner-mockup-sidebar-row">✎</span>
                    <span className="wispr-banner-mockup-sidebar-row">☰</span>
                    <span className="wispr-banner-mockup-sidebar-row">◳</span>
                  </div>
                  <div className="wispr-banner-mockup-content">
                    <p className="wispr-banner-mockup-text">
                      The core principle is about agency and stakes. A progress bar says &ldquo;you
                      have a shrinking window to do something&rdquo; &mdash; it puts the user in
                      control of a timed decision.
                    </p>
                  </div>
                </div>
              </div>
            }
          />

          <WisprTabs
            tabs={[{ key: 'recents', label: 'Recents' }]}
            activeKey="recents"
            onChange={() => {}}
            sticky
            utils={
              <>
                <button
                  type="button"
                  className="wispr-icon-button"
                  title="Search your notes"
                  aria-label="Search your notes"
                  onClick={openSearch}
                >
                  <SearchIcon size={16} />
                </button>
                <button
                  type="button"
                  className="wispr-icon-button"
                  title="New note"
                  aria-label="New note"
                  onClick={handleNew}
                >
                  <PlusIcon size={16} />
                </button>
                <button
                  type="button"
                  className="wispr-icon-button"
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
            <div className="wispr-snippets-search-row">
              <input
                ref={searchRef}
                className="wispr-dialog-input"
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
                  className="wispr-icon-button"
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

          <div className="wispr-notes-list wispr-notes-column">
            {visibleNotes.length === 0 ? (
              <div className="wispr-empty-flat">
                {search.trim() ? 'No matching notes' : 'No notes found'}
              </div>
            ) : (
              visibleNotes.map((note) => (
                <div
                  key={note.id}
                  id={`note-card-${note.id}`}
                  data-note-id={note.id}
                  className={cn(
                    'wispr-note-item',
                    activeId === note.id && 'wispr-note-item-active'
                  )}
                  role="option"
                  aria-selected={activeId === note.id}
                  onClick={() => handleSelect(note)}
                >
                  {note.pinned ? (
                    <div className="wispr-note-pinned-box">
                      <span className="wispr-note-pinned" title="Pinned">
                        <PinIcon size={14} />
                      </span>
                    </div>
                  ) : null}
                  <div className="wispr-note-body">
                    <div className="wispr-note-title">{noteTitle(note.text)}</div>
                    <div className="wispr-note-preview">{note.text || 'Empty note'}</div>
                    <div className="wispr-note-footer">
                      <span>{fmtDate(note.createdAt)}</span>
                    </div>
                  </div>
                  <div className="wispr-note-actions">
                    <button
                      type="button"
                      className="wispr-note-action"
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
                      className="wispr-note-action"
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
                      className="wispr-note-action"
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

          {/* The editor stays embedded so dictation keeps working from this tab. */}
          {activeNote ? (
            <div className="wispr-note-editor">
              <div className="wispr-note-editor-toolbar">
                <Button variant="secondary" size="sm" onClick={handleNew}>
                  <PlusIcon size={14} /> New note
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handlePin(activeNote.id)}>
                  <PinIcon size={14} /> {activeNote.pinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <CopyIcon size={14} /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handleDelete(activeNote.id)}>
                  <TrashIcon size={14} /> Delete
                </Button>
                <span className="wispr-note-editor-status">
                  {saving ? 'Saving…' : ''}
                </span>
              </div>
              <textarea
                ref={textareaRef}
                className="wispr-note-editor-textarea"
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

      {/* Scratchpad shortcut */}
      <Dialog open={shortcutOpen} onOpenChange={setShortcutOpen}>
        <DialogContent>
          <DialogTitle>Open Scratchpad</DialogTitle>
          <DialogDescription>
            Press to open the Scratchpad tab from anywhere in the hub.
          </DialogDescription>
          <div className="wispr-dialog">
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
            <div className="wispr-dialog-actions">
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

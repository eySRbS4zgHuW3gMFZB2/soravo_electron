import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CloseIcon, CopyIcon, TrashIcon } from '@/components/icons'
import { soravo } from './soravo'
import type { ScratchpadNote } from './soravo'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

export default function ScratchpadPage() {
  const [notes, setNotes] = useState<ScratchpadNote[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [hotkey, setHotkey] = useState('CommandOrControl+Alt+Space')
  const [textareaFocused, setTextareaFocused] = useState(false)
  // Track if the current recording was initiated from this page
  const recordingFromScratchpad = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    soravo.getSettings().then((s) => setHotkey(s.hotkey)).catch(() => {})
    const off = soravo.onScratchpadChanged(() => {
      loadNotes()
    })
    // Append transcript text if recording was initiated from this page.
    // Don't reset the flag here - it's reset on next keydown.
    const offTranscript = soravo.onTranscript((text) => {
      if (recordingFromScratchpad.current) {
        setDraft((prev) => (prev ? prev + ' ' + text : text))
      }
    })
    return () => {
      off()
      offTranscript()
    }
  }, [])

  // When textarea is focused, disable global hook
  useEffect(() => {
    soravo.setTextareaFocus(textareaFocused).catch(() => {})
  }, [textareaFocused])

  // keydown: start recording (only when textarea focused, global hook disabled)
  useEffect(() => {
    const keyDownHandler = (e: KeyboardEvent) => {
      if (!textareaFocused) return
      if (e.repeat) return
      if (!isHotkeyMatch(e)) return
      e.preventDefault()
      e.stopPropagation()
      recordingFromScratchpad.current = true
      soravo.toggle().catch(console.error)
    }
    window.addEventListener('keydown', keyDownHandler)
    return () => window.removeEventListener('keydown', keyDownHandler)
  }, [textareaFocused, hotkey])

  const activeNote = notes.find((n) => n.id === activeId) ?? null

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

  return (
    <div className="scratchpad-page">
      <div className="scratchpad-body">
        {/* Sidebar: recent notes */}
        <div className="scratchpad-sidebar">
          <div className="scratchpad-sidebar-header">
            <Button variant="default" size="sm" className="w-full" onClick={handleNew}>
              + New note
            </Button>
          </div>
          <div className="scratchpad-note-list">
            {notes.length === 0 && (
              <div className="scratchpad-empty">No notes yet</div>
            )}
            {notes.map((note) => (
              <button
                key={note.id}
                className={cn('scratchpad-note-item', activeId === note.id && 'active', note.pinned && 'pinned')}
                onClick={() => handleSelect(note)}
              >
                <div className="scratchpad-note-preview">
                  {note.text.slice(0, 60) || 'Empty note'}
                </div>
                <div className="scratchpad-note-meta">
                  {note.pinned && <span className="scratchpad-pin">📌</span>}
                  <span className="scratchpad-note-date">{fmtDate(note.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main editor */}
        <div className="scratchpad-editor">
          {activeNote ? (
            <>
              <div className="scratchpad-toolbar">
                <Button variant="ghost" size="sm" onClick={() => handlePin(activeNote.id)}>
                  {activeNote.pinned ? '📌 Unpin' : '📌 Pin'}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  <CopyIcon /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(activeNote.id)}>
                  <TrashIcon /> Delete
                </Button>
                <span className="scratchpad-save-status">
                  {saving ? 'Saving…' : ''}
                </span>
              </div>
              <textarea
                ref={textareaRef}
                className="scratchpad-textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => setTextareaFocused(true)}
                onBlur={(e) => { setTextareaFocused(false); handleBlur() }}
                placeholder="Start typing or dictate…"
                autoFocus
              />
            </>
          ) : (
            <div className="scratchpad-welcome">
              <p>No note selected</p>
              <Button onClick={handleNew}>Create your first note</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
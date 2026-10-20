import { useState } from 'react'
import type { SoravoSettings } from '../soravo'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { PageHero } from '@/components/pages/PageHero'
import { GlobeIcon, SparkleIcon, TypeIcon } from '@/components/pages/icons'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
  { value: 'ru', label: 'Russian' },
  { value: 'tr', label: 'Turkish' }
]

type StylePageProps = {
  settings: SoravoSettings | null
  onSave: (patch: Partial<SoravoSettings>) => Promise<void>
}

/**
 * The Style page.
 *
 * Wispr Flow's Style page holds the writing styles Soravo applies when it
 * dictates. Soravo has the same idea, but a single local style rather than one
 * per application, so this page presents the clean-up, punctuation and
 * language rules as the style cards they are.
 */
export default function StylePage({ settings, onSave }: StylePageProps) {
  const [saving, setSaving] = useState(false)

  const update = async (patch: Partial<SoravoSettings>) => {
    setSaving(true)
    try {
      await onSave(patch)
    } catch (e) {
      console.error('Could not save the style', e)
    } finally {
      setSaving(false)
    }
  }

  const smartCleanup = settings?.smartCleanup ?? true
  const addPunctuation = settings?.addPunctuation ?? true
  const language = settings?.language || 'en'

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-head-title">Style</h1>
        <div className="page-head-actions">
          {saving ? <span className="page-badge page-badge-muted">Saving…</span> : null}
        </div>
      </div>

      <div className="page-scroll">
        <div className="page-column">
          <div className="page-stack">
            <PageHero
              media="flow"
              title={
                <>
                  Make Soravo sound like <em>you</em>
                </>
              }
              description="Pick the rules Soravo applies to every dictation. Everything here is stored on this device and can be changed whenever you like."
              cta={
                <Button onClick={() => document.getElementById('style-cards')?.scrollIntoView({ behavior: 'smooth' })}>
                  Choose your style
                </Button>
              }
            />

            <div className="style-grid" id="style-cards">
              <div className="style-card">
                <div className="style-card-head">
                  <h2 className="style-card-name">Clean-up</h2>
                  <SparkleIcon size={18} />
                </div>
                <p className="style-card-desc">
                  Strips filler words like um, uh, er, ah and hmm, then tidies the spacing.
                </p>
                <div className="style-card-head" style={{ marginTop: 'auto', alignItems: 'center' }}>
                  <span className="page-badge">{smartCleanup ? 'On' : 'Off'}</span>
                  <Switch
                    checked={smartCleanup}
                    onCheckedChange={(c) => void update({ smartCleanup: c === true })}
                    aria-label="Clean-up"
                  />
                </div>
              </div>

              <div className="style-card">
                <div className="style-card-head">
                  <h2 className="style-card-name">Punctuation</h2>
                  <TypeIcon size={18} />
                </div>
                <p className="style-card-desc">
                  Adds a full stop when a dictation ends without a period, an exclamation mark or a question mark.
                </p>
                <div className="style-card-head" style={{ marginTop: 'auto', alignItems: 'center' }}>
                  <span className="page-badge">{addPunctuation ? 'On' : 'Off'}</span>
                  <Switch
                    checked={addPunctuation}
                    onCheckedChange={(c) => void update({ addPunctuation: c === true })}
                    aria-label="Punctuation"
                  />
                </div>
              </div>

              <div className="style-card">
                <div className="style-card-head">
                  <h2 className="style-card-name">Language</h2>
                  <GlobeIcon size={18} />
                </div>
                <p className="style-card-desc">
                  The language Soravo transcribes in. It also tunes the clean-up rules for that language.
                </p>
                <div style={{ marginTop: 'auto' }}>
                  <Select value={language} onValueChange={(v) => void update({ language: v })}>
                    <SelectTrigger aria-label="Dictation language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <p className="hub-note">
              Your own phrases live in the Dictionary, and the text you re-use lives in Snippets.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

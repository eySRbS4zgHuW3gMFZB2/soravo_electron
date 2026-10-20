import { useEffect, useState } from 'react'
import type { ModelInfo } from '../soravo'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

/**
 * The Models page.
 *
 * Wispr Flow has no models page - its Transforms page is the closest match,
 * with a grid of cards and a "create your own" card. Soravo lists the
 * downloadable transcription models in the same shape.
 */
export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [downloading, setDownloading] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [runtime, setRuntime] = useState<{ binary: boolean; model: string; modelPresent: boolean } | null>(null)

  const refresh = () => {
    window.soravo.listModels().then(setModels).catch(() => setModels([]))
    window.soravo.getRuntimeStatus().then(setRuntime).catch(() => setRuntime(null))
  }

  useEffect(() => {
    refresh()
    const offProgress = window.soravo.onModelDownloadProgress((p) => {
      if (p.id === downloading) setProgress(p.percent)
    })
    const offComplete = window.soravo.onModelDownloadComplete((p) => {
      setDownloading(null)
      setProgress(0)
      refresh()
      // Auto-activate if no active model
      window.soravo.getSettings().then((s) => {
        if (!s.model) void window.soravo.setActiveModel(p.id).then(refresh)
      }).catch(() => {})
    })
    return () => { offProgress(); offComplete() }
  }, [downloading])

  const handleDownload = (id: string) => {
    setDownloading(id)
    setProgress(0)
    setError('')
    window.soravo.downloadModel(id).catch((e) => {
      setError(String(e))
      setDownloading(null)
      setProgress(0)
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm(`Delete model ${id}?`)) return
    window.soravo.deleteModel(id).then(refresh).catch((e) => setError(String(e)))
  }

  const handleActivate = (id: string) => {
    window.soravo.setActiveModel(id).then(refresh).catch((e) => setError(String(e)))
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-head-title">Models</h1>
        <div className="page-head-actions">
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="page-scroll">
        <div className="page-column">
          <div className="page-stack">
            {runtime !== null ? (
              <p
                className="hub-note"
                style={{
                  color: runtime.binary && runtime.modelPresent ? 'var(--soravo-positive)' : 'var(--soravo-negative)'
                }}
              >
                {runtime.binary && runtime.modelPresent
                  ? `Transcription engine ready - using ${runtime.model}.`
                  : !runtime.binary
                    ? 'Transcription engine missing. Reinstall Soravo or re-run the bundled fetch:asr script.'
                    : `Transcription engine is installed, but the active model "${runtime.model}" is not. Download it below or pick another.`}
              </p>
            ) : null}
            {error ? (
              <p className="hub-note" style={{ color: 'var(--soravo-negative)' }}>
                {error}
              </p>
            ) : null}

            {models.length === 0 ? (
              <div className="page-empty">
                <p className="page-empty-title">No models found</p>
                <p className="page-empty-body">
                  Soravo could not read the model list. Restart the app and try again.
                </p>
              </div>
            ) : (
              <div className="model-grid">
                {models.map((m) => (
                  <div className="model-card" key={m.id}>
                    <h2 className="model-card-name">{m.name}</h2>
                    <p className="model-card-meta">
                      {m.sizeLabel} &middot; {m.license} license
                    </p>
                    <div>
                      {m.active ? (
                        <span className="page-badge">Active</span>
                      ) : m.installed ? (
                        <span className="page-badge page-badge-muted">Installed</span>
                      ) : null}
                    </div>
                    {downloading === m.id ? (
                      <div style={{ width: '100%' }}>
                        <Progress value={progress} />
                        <div style={{ fontSize: 11, marginTop: 2 }}>{progress}%</div>
                      </div>
                    ) : null}
                    <div className="model-card-actions">
                      {!m.installed && downloading !== m.id ? (
                        <Button variant="secondary" size="sm" onClick={() => handleDownload(m.id)}>
                          Download
                        </Button>
                      ) : null}
                      {downloading === m.id ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setDownloading(null)
                            setProgress(0)
                          }}
                        >
                          Cancel
                        </Button>
                      ) : null}
                      {m.installed && !m.active ? (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => handleActivate(m.id)}>
                            Set Active
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)}>
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="hub-note">
              Models are downloaded to %APPDATA%/soravo/models/. Larger models are more accurate but slower.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

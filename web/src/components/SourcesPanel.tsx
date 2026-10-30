import { useEffect, useRef } from 'react'
import { FileSpreadsheet, FileText, X } from 'lucide-react'
import type { Source } from '../api/types'
import { highlightTerms, relativeScore } from '../lib/format'
import { IconButton } from './ui'

type Props = {
  open: boolean
  close: () => void
  sources: Source[]
  question: string
  activeIndex: number | null
  onOpenDocument: (source: Source) => void
  onSelect: (index: number) => void
}

function Highlighted({ text, question }: { text: string; question: string }) {
  const ranges = highlightTerms(text, question)
  if (!ranges.length) return <>{text}</>

  const parts: React.ReactNode[] = []
  let cursor = 0
  ranges.forEach((range, position) => {
    if (range.start < cursor) return
    if (range.start > cursor) parts.push(text.slice(cursor, range.start))
    parts.push(<mark key={`mark-${position}`}>{text.slice(range.start, range.end)}</mark>)
    cursor = range.end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

export function SourcesPanel({ open, close, sources, question, activeIndex, onOpenDocument, onSelect }: Props) {
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || activeIndex === null) return
    const card = list.current?.querySelector<HTMLElement>(`[data-source-card="${activeIndex}"]`)
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open, activeIndex])

  const extension = (source: Source) => {
    const match = /\.([a-z0-9]+)$/i.exec(source.document)
    return match ? match[1].toUpperCase() : 'DOC'
  }

  return (
    <aside className={`sources-panel ${open ? 'open' : ''}`} aria-label="Sources récupérées" aria-hidden={!open}>
      <div className="panel-header">
        <div>
          <h2>Sources</h2>
          <p>
            {sources.length > 0
              ? `${sources.length} extrait${sources.length > 1 ? 's' : ''} récupéré${sources.length > 1 ? 's' : ''}`
              : 'Aucun extrait pour l’instant'}
          </p>
        </div>
        <IconButton label="Fermer les sources" onClick={close}>
          <X size={18} />
        </IconButton>
      </div>

      <div className="source-list" ref={list}>
        {sources.length === 0 ? (
          <p className="sidebar-hint">
            Les extraits utilisés pour répondre apparaîtront ici, avec leur document, leur page et leur pertinence.
          </p>
        ) : null}

        {sources.map((source, index) => {
          const numberOf = index + 1
          const isSpreadsheet = ['CSV', 'XLSX'].includes(extension(source))
          return (
            <article
              className={`source-card ${activeIndex === numberOf ? 'active' : ''}`}
              key={`${source.id}-${numberOf}`}
              data-source-card={numberOf}
              onClick={() => onSelect(numberOf)}
            >
              <div className="source-top">
                <span className="file-type">{isSpreadsheet ? <FileSpreadsheet size={16} /> : <FileText size={16} />}</span>
                <span>
                  <strong title={source.document}>{source.document}</strong>
                  <small>
                    {source.page ?? 'Extrait'} · {extension(source)}
                  </small>
                </span>
                <span className="source-number">{numberOf}</span>
              </div>

              <p>
                « <Highlighted text={source.excerpt} question={question} /> »
              </p>

              {source.score === null ? (
                <small className="source-muted">Pertinence non conservée pour cette source archivée</small>
              ) : (
                <>
                  <div className="relevance">
                    <span style={{ width: `${Math.round(Math.max(0, Math.min(1, source.score)) * 100)}%` }} />
                  </div>
                  <div className="source-footer">
                    <small>{relativeScore(source.score)} de similarité</small>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenDocument(source)
                      }}
                    >
                      Ouvrir le document
                    </button>
                  </div>
                </>
              )}

              {source.score === null ? (
                <div className="source-footer">
                  <small>Archive</small>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenDocument(source)
                    }}
                  >
                    Ouvrir le document
                  </button>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </aside>
  )
}

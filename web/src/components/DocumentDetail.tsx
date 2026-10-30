import { Download, RefreshCw, Trash2, X } from 'lucide-react'
import { api } from '../api/client'
import type { DocumentRow } from '../api/types'
import { formatBytes, formatDate, statusLabel } from '../lib/format'
import { IconButton } from './ui'

type Props = {
  document: DocumentRow
  busy: boolean
  onClose: () => void
  onReindex: (document: DocumentRow) => void
  onDelete: (document: DocumentRow) => void
}

export function DocumentDetail({ document, busy, onClose, onReindex, onDelete }: Props) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className="command-palette detail-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Détail de ${document.name}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="panel-header detail-header">
          <div>
            <p className="eyebrow">DOCUMENT</p>
            <h2>{document.name}</h2>
          </div>
          <IconButton label="Fermer le détail" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Statut</dt>
            <dd>
              <span
                className={`status ${document.status === 'indexe' ? 'indexed' : document.status === 'en_attente' ? 'pending' : 'error'}`}
              >
                <i />
                {statusLabel(document.status)}
              </span>
            </dd>
          </div>
          <div>
            <dt>Base de connaissances</dt>
            <dd>{document.category}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{document.ext.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Taille</dt>
            <dd>{formatBytes(document.size_bytes)}</dd>
          </div>
          <div>
            <dt>Pages / feuilles</dt>
            <dd>{document.pages ?? '—'}</dd>
          </div>
          <div>
            <dt>Extraits indexés</dt>
            <dd>{document.chunk_count}</dd>
          </div>
          <div>
            <dt>Ajouté le</dt>
            <dd>{formatDate(document.created_at)}</dd>
          </div>
          <div>
            <dt>Indexé le</dt>
            <dd>{document.indexed_at ? formatDate(document.indexed_at) : '—'}</dd>
          </div>
        </dl>

        {document.error ? (
          <div className="banner error detail-error" role="alert">
            <div>
              <strong>Indexation en échec</strong>
              <p>{document.error}</p>
            </div>
          </div>
        ) : null}

        <div className="detail-actions">
          <a className="ghost-button" href={api.documentFileUrl(document.id)} target="_blank" rel="noreferrer">
            <Download size={15} /> Ouvrir l’original
          </a>
          <button type="button" className="ghost-button" onClick={() => onReindex(document)} disabled={busy}>
            <RefreshCw size={15} /> {busy ? 'Indexation…' : 'Réindexer'}
          </button>
          <button type="button" className="danger-button" onClick={() => onDelete(document)} disabled={busy}>
            <Trash2 size={15} /> Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

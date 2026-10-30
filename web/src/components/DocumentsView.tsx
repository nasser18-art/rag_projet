import { useEffect, useRef, useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import type { DocumentList, DocumentRow, KnowledgeBases } from '../api/types'
import { formatBytes, formatDate, statusLabel } from '../lib/format'
import { Banner, EmptyState, IconButton, Spinner } from './ui'

type StatusFilter = '' | 'indexe' | 'en_attente' | 'erreur'

type Props = {
  documents: DocumentList | null
  loading: boolean
  error: string | null
  onRetry: () => void
  status: StatusFilter
  onStatusChange: (status: StatusFilter) => void
  query: string
  onQueryChange: (query: string) => void
  category: string | null
  knowledge: KnowledgeBases | null
  upload: { name: string } | null
  onUpload: (files: File[]) => void
  onOpenDocument: (document: DocumentRow) => void
  onReindex: (document: DocumentRow) => void
  onDelete: (document: DocumentRow) => void
  onSelectCategory: (category: string | null) => void
}

const FILTERS: { value: StatusFilter; label: string; key: 'all' | 'indexe' | 'en_attente' | 'erreur' }[] = [
  { value: '', label: 'Tous', key: 'all' },
  { value: 'indexe', label: 'Indexés', key: 'indexe' },
  { value: 'en_attente', label: 'En attente', key: 'en_attente' },
  { value: 'erreur', label: 'En erreur', key: 'erreur' },
]

function isSpreadsheet(document: DocumentRow) {
  return ['csv', 'xlsx'].includes(document.ext)
}

export function DocumentsView({
  documents,
  loading,
  error,
  onRetry,
  status,
  onStatusChange,
  query,
  onQueryChange,
  category,
  knowledge,
  upload,
  onUpload,
  onOpenDocument,
  onReindex,
  onDelete,
  onSelectCategory,
}: Props) {
  const [dragging, setDragging] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const accept = knowledge?.formats.map((format) => `.${format}`).join(',') ?? '.pdf,.docx,.csv,.xlsx'
  const counts = documents?.counts ?? { all: 0, indexe: 0, en_attente: 0, erreur: 0 }

  useEffect(() => {
    if (!menuFor) return
    const close = () => setMenuFor(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', close)
    }
  }, [menuFor])

  return (
    <section className="documents-view">
      <header className="documents-heading">
        <div>
          <p className="eyebrow">BASE DE CONNAISSANCES</p>
          <h1>Documents</h1>
          <p>
            {counts.all} document{counts.all > 1 ? 's' : ''} · {counts.indexe} indexé{counts.indexe > 1 ? 's' : ''} ·{' '}
            {category ?? 'toutes les bases'}
          </p>
        </div>
        <button type="button" className="primary-button" onClick={() => input.current?.click()} disabled={!!upload}>
          <Plus size={17} /> Ajouter des documents
        </button>
      </header>

      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        accept={accept}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length) onUpload(files)
          event.target.value = ''
        }}
      />

      <button
        type="button"
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const files = Array.from(event.dataTransfer.files ?? [])
          if (files.length) onUpload(files)
        }}
      >
        {upload ? <Spinner size={22} /> : <UploadCloud size={24} />}
        <span>
          <strong>{upload ? upload.name : 'Déposez vos fichiers ici'}</strong>
          <small>
            {upload
              ? 'Envoi, extraction et indexation en cours…'
              : `PDF, DOCX, XLSX ou CSV · ${knowledge ? formatBytes(knowledge.max_upload_bytes) : ''} maximum · base « ${category ?? 'Général'} »`}
          </small>
        </span>
      </button>

      <div className="document-toolbar">
        <div className="segmented" role="tablist" aria-label="Filtrer par statut">
          {FILTERS.map((filter) => (
            <button
              type="button"
              key={filter.value}
              role="tab"
              aria-selected={status === filter.value}
              className={status === filter.value ? 'active' : ''}
              onClick={() => onStatusChange(filter.value)}
            >
              {filter.label} <span>{counts[filter.key]}</span>
            </button>
          ))}
        </div>

        <div className="toolbar-right">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Rechercher un document"
              placeholder="Rechercher un document"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            {query ? (
              <button type="button" className="clear-search" aria-label="Effacer la recherche" onClick={() => onQueryChange('')}>
                <X size={13} />
              </button>
            ) : null}
          </label>
          <label className="select-button select-field category-select">
            <span className="sr-only">Base de connaissances</span>
            <select
              value={category ?? ''}
              onChange={(event) => onSelectCategory(event.target.value || null)}
              aria-label="Filtrer par base de connaissances"
            >
              <option value="">Toutes les bases</option>
              {(knowledge?.categories ?? []).map((base) => (
                <option key={base.name} value={base.name}>
                  {base.name} ({base.documents})
                </option>
              ))}
            </select>
          </label>
          <IconButton label="Rafraîchir la liste" onClick={onRetry}>
            <RefreshCw size={16} />
          </IconButton>
        </div>
      </div>

      {error ? <Banner title="Chargement impossible" detail={error} action={{ label: 'Réessayer', onClick: onRetry }} /> : null}

      {loading && !documents ? (
        <p className="sidebar-hint">
          <Spinner /> Chargement des documents…
        </p>
      ) : null}

      {documents && documents.documents.length === 0 ? (
        <EmptyState
          title={query || status ? 'Aucun document ne correspond' : 'La base est vide'}
          detail={
            query || status
              ? 'Modifiez le filtre ou la recherche pour retrouver un document.'
              : 'Importez un fichier PDF, DOCX, XLSX ou CSV : il sera extrait, découpé puis indexé automatiquement.'
          }
        />
      ) : null}

      {documents && documents.documents.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Taille</th>
                <th>Statut</th>
                <th>Ajouté le</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <span className="doc-icon">
                      {isSpreadsheet(document) ? <FileSpreadsheet size={18} /> : <FileText size={18} />}
                    </span>
                    <span className="doc-name">
                      <button type="button" className="link-button" onClick={() => onOpenDocument(document)}>
                        {document.name}
                      </button>
                      <small>
                        {document.category} · {document.chunk_count} extrait{document.chunk_count > 1 ? 's' : ''}
                        {document.pages ? ` · ${document.pages} page${document.pages > 1 ? 's' : ''}` : ''}
                      </small>
                    </span>
                  </td>
                  <td>{document.ext.toUpperCase()}</td>
                  <td>{formatBytes(document.size_bytes)}</td>
                  <td>
                    <span
                      className={`status ${document.status === 'indexe' ? 'indexed' : document.status === 'en_attente' ? 'pending' : 'error'}`}
                      title={document.error ?? statusLabel(document.status)}
                    >
                      <i />
                      {statusLabel(document.status)}
                    </span>
                  </td>
                  <td>{formatDate(document.created_at)}</td>
                  <td className="row-actions">
                    <div className="menu-anchor">
                      <button
                        type="button"
                        className="kebab"
                        aria-label={`Actions pour ${document.name}`}
                        aria-expanded={menuFor === document.id}
                        onClick={(event) => {
                          event.stopPropagation()
                          setMenuFor(menuFor === document.id ? null : document.id)
                        }}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                      {menuFor === document.id ? (
                        <div className="action-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                          <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onOpenDocument(document) }}>
                            <FileText size={15} /> Détails
                          </button>
                          <a role="menuitem" href={api.documentFileUrl(document.id)} target="_blank" rel="noreferrer">
                            <Download size={15} /> Ouvrir l’original
                          </a>
                          <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onReindex(document) }}>
                            <RefreshCw size={15} /> Réindexer
                          </button>
                          <button type="button" role="menuitem" className="danger" onClick={() => { setMenuFor(null); onDelete(document) }}>
                            <Trash2 size={15} /> Supprimer
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="documents-footnote">
        L’extraction, le découpage et l’indexation sont réalisés par le serveur. Un document en erreur reste enregistré :
        consultez son détail pour connaître la cause exacte.
      </p>
    </section>
  )
}

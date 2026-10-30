import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, FolderOpen, MessageSquare, Plus, Search } from 'lucide-react'
import { api, describeError } from '../api/client'
import type { Conversation, DocumentRow, SearchResults } from '../api/types'
import { Spinner } from './ui'

type Props = {
  onClose: () => void
  onNewConversation: () => void
  onGoToDocuments: () => void
  onSelectConversation: (id: string) => void
  onOpenDocument: (document: DocumentRow) => void
}

type Item = { key: string; kind: 'action' | 'document' | 'conversation'; label: string; hint: string; run: () => void }

export function CommandPalette({ onClose, onNewConversation, onGoToDocuments, onSelectConversation, onOpenDocument }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(0)
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    api
      .conversations()
      .then((payload) => {
        if (!cancelled) setAllConversations(payload.conversations)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setResults(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      api
        .search(term)
        .then((payload) => {
          setResults(payload)
          setError(null)
        })
        .catch((caught) => {
          const described = describeError(caught)
          setError(`${described.title} ${described.detail}`.trim())
        })
        .finally(() => setLoading(false))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [query])

  const items = useMemo<Item[]>(() => {
    const base: Item[] = [
      {
        key: 'new',
        kind: 'action',
        label: 'Nouvelle conversation',
        hint: 'Interroger la base documentaire',
        run: onNewConversation,
      },
      {
        key: 'documents',
        kind: 'action',
        label: 'Ouvrir les documents',
        hint: 'Importer, réindexer, supprimer',
        run: onGoToDocuments,
      },
    ]

    const term = query.trim().toLocaleLowerCase('fr')
    if (!term) {
      return [
        ...base,
        ...allConversations.slice(0, 4).map<Item>((conversation) => ({
          key: `conversation-${conversation.id}`,
          kind: 'conversation',
          label: conversation.title,
          hint: 'Conversation récente',
          run: () => onSelectConversation(conversation.id),
        })),
      ]
    }

    const filteredActions = base.filter((item) => item.label.toLocaleLowerCase('fr').includes(term))
    const documents = (results?.documents ?? []).slice(0, 5).map<Item>((document) => ({
      key: `document-${document.id}`,
      kind: 'document',
      label: document.name,
      hint: `${document.category} · ${document.ext.toUpperCase()}`,
      run: () => onOpenDocument(document),
    }))
    const conversations = (results?.conversations ?? []).slice(0, 5).map<Item>((conversation) => ({
      key: `conversation-${conversation.id}`,
      kind: 'conversation',
      label: conversation.title,
      hint: 'Conversation',
      run: () => onSelectConversation(conversation.id),
    }))
    return [...filteredActions, ...documents, ...conversations]
  }, [allConversations, onGoToDocuments, onNewConversation, onOpenDocument, onSelectConversation, query, results])

  useEffect(() => {
    setCursor(0)
  }, [items.length, query])

  const choose = (item: Item) => {
    item.run()
    onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setCursor((current) => Math.min(current + 1, items.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setCursor((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter' && items[cursor]) {
            event.preventDefault()
            choose(items[cursor])
          }
        }}
      >
        <div className="command-search">
          <Search size={19} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une conversation, un document ou une action…"
            aria-label="Rechercher"
          />
          {loading ? <Spinner /> : <kbd>ESC</kbd>}
        </div>

        {error ? <p className="palette-error">{error}</p> : null}

        <div ref={listRef} className="palette-list">
          {items.length === 0 && !loading && query ? <p className="sidebar-hint">Aucun résultat pour « {query} ».</p> : null}
          {items.map((item, index) => (
            <button
              type="button"
              key={item.key}
              className={index === cursor ? 'active' : ''}
              onMouseEnter={() => setCursor(index)}
              onClick={() => choose(item)}
            >
              {item.kind === 'action' ? <Plus size={17} /> : item.kind === 'document' ? <FileText size={17} /> : <MessageSquare size={17} />}
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </div>

        <p className="palette-footnote">
          <FolderOpen size={12} /> ↑ ↓ pour naviguer · Entrée pour ouvrir · Échap pour fermer
        </p>
      </div>
    </div>
  )
}

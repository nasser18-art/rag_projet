import { Database, FolderOpen, MessageSquare, Plus, Search, Trash2, X } from 'lucide-react'
import type { Health, KnowledgeBases, Conversation } from '../api/types'
import { groupByDay } from '../lib/format'
import { IconButton, Spinner } from './ui'

type Props = {
  open: boolean
  close: () => void
  view: 'chat' | 'documents'
  onNavigate: (view: 'chat' | 'documents') => void
  conversations: Conversation[]
  activeId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  onDeleteConversation: (conversation: Conversation) => void
  conversationsLoading: boolean
  conversationsError: string | null
  onRetryConversations: () => void
  knowledge: KnowledgeBases | null
  category: string | null
  onSelectCategory: (category: string | null) => void
  health: Health | null
  healthError: string | null
  onOpenCommands: () => void
}

export function Sidebar({
  open,
  close,
  view,
  onNavigate,
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  conversationsLoading,
  conversationsError,
  onRetryConversations,
  knowledge,
  category,
  onSelectCategory,
  health,
  healthError,
  onOpenCommands,
}: Props) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navigation principale">
      <div className="brand">
        <span className="brand-mark">N</span>
        <strong>Nexus</strong>
        <IconButton label="Fermer le menu" className="mobile-only" onClick={close}>
          <X size={18} />
        </IconButton>
      </div>

      <button type="button" className="new-conversation" onClick={onNewConversation}>
        <Plus size={17} /> Nouvelle conversation
      </button>

      <nav>
        <button
          type="button"
          className={view === 'chat' ? 'nav-active' : ''}
          onClick={() => {
            onNavigate('chat')
            close()
          }}
        >
          <MessageSquare size={17} /> Conversations
        </button>
        <button
          type="button"
          className={view === 'documents' ? 'nav-active' : ''}
          onClick={() => {
            onNavigate('documents')
            close()
          }}
        >
          <FolderOpen size={17} /> Documents
        </button>
        <button type="button" onClick={onOpenCommands}>
          <Search size={17} /> Rechercher <kbd style={{ marginLeft: 'auto' }}>⌘K</kbd>
        </button>
      </nav>

      <section className="sidebar-section">
        {conversationsLoading && conversations.length === 0 ? (
          <p className="sidebar-hint">
            <Spinner /> Chargement de l’historique…
          </p>
        ) : null}
        {conversationsError ? (
          <div className="sidebar-error">
            <p>{conversationsError}</p>
            <button type="button" onClick={onRetryConversations}>
              Réessayer
            </button>
          </div>
        ) : null}
        {!conversationsLoading && !conversationsError && conversations.length === 0 ? (
          <p className="sidebar-hint">Aucune conversation enregistrée pour l’instant.</p>
        ) : null}

        {groupByDay(conversations).map((group) => (
          <div key={group.label}>
            <p className="section-label">{group.label}</p>
            {group.items.map((conversation) => (
              <div className={`history-row ${conversation.id === activeId ? 'active' : ''}`} key={conversation.id}>
                <button
                  type="button"
                  className={`history ${conversation.id === activeId ? 'active' : ''}`}
                  title={conversation.title}
                  onClick={() => {
                    onSelectConversation(conversation.id)
                    close()
                  }}
                >
                  {conversation.title}
                </button>
                <button
                  type="button"
                  className="history-delete"
                  aria-label={`Supprimer « ${conversation.title} »`}
                  title="Supprimer la conversation"
                  onClick={() => onDeleteConversation(conversation)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="sidebar-section knowledge">
        <p className="section-label">Bases de connaissances</p>
        <button type="button" className={category === null ? 'nav-active' : ''} onClick={() => onSelectCategory(null)}>
          <Database size={14} /> Toutes les bases
          <span>{health ? health.documents_count : '—'}</span>
        </button>
        {knowledge?.categories.length
          ? knowledge.categories.map((base) => (
              <button
                type="button"
                key={base.name}
                className={category === base.name ? 'nav-active' : ''}
                onClick={() => onSelectCategory(category === base.name ? null : base.name)}
                title={`${base.indexed} document(s) indexé(s) · ${base.chunks} extrait(s)`}
              >
                <i className={`status-dot ${base.indexed === base.documents ? 'green' : 'amber'}`} />
                {base.name}
                <span>{base.documents}</span>
              </button>
            ))
          : null}
        {knowledge && knowledge.categories.length === 0 ? <p className="sidebar-hint">Aucun document importé.</p> : null}
      </section>

      <div className="profile">
        <span className={`status-dot ${health?.knowledge_base_ready ? 'green' : healthError ? 'amber' : 'blue'}`} />
        <span>
          <strong>
            {healthError ? 'Serveur injoignable' : !health ? 'Connexion au serveur…' : health.knowledge_base_ready ? 'Base prête' : 'Base incomplète'}
          </strong>
          <small>
            {healthError
              ? healthError
              : health
                ? `${health.documents_count} document(s) · ${health.chunks_indexed} extrait(s)`
                : 'Vérification…'}
          </small>
        </span>
      </div>
    </aside>
  )
}

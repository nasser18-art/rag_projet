import { Clipboard, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { Health, Message } from '../api/types'
import { renderAnswer } from '../lib/format'
import { Banner, EmptyState, IconButton, Spinner } from './ui'

type Props = {
  title: string | null
  messages: Message[]
  streaming: boolean
  loading: boolean
  loadError: { title: string; detail: string } | null
  streamError: { title: string; detail: string; retry?: () => void } | null
  health: Health | null
  contextLabel: string
  onRetryLoad: () => void
  onDismissStreamError: () => void
  onCopy: (text: string) => void
  onFeedback: (messageId: string, value: 'up' | 'down') => void
  onRegenerate: (question: string) => void
  onSourceClick: (index: number) => void
  onGoToDocuments: () => void
  children?: React.ReactNode
}

export function ChatView({
  title,
  messages,
  streaming,
  loading,
  loadError,
  streamError,
  health,
  contextLabel,
  onRetryLoad,
  onDismissStreamError,
  onCopy,
  onFeedback,
  onRegenerate,
  onSourceClick,
  onGoToDocuments,
  children,
}: Props) {
  const lastAssistantIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'assistant') return index
    }
    return -1
  })()

  const questionBefore = (index: number): string | null => {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (messages[cursor].role === 'user') return messages[cursor].content
    }
    return null
  }

  const handleAnswerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-source-index]')
    if (!target) return
    onSourceClick(Number(target.dataset.sourceIndex))
  }

  const empty = messages.length === 0 && !loading && !loadError
  const assistantLabel = (count: number) =>
    count > 0 ? `Réponse fondée sur ${count} extrait${count > 1 ? 's' : ''}` : 'Réponse sans extrait retrouvé'

  return (
    <section className="chat-main">
      <div className="conversation">
        <div className="chat-title">
          <span>{contextLabel}</span>
          <h1>{title ?? 'Poser une question'}</h1>
        </div>

        {loadError ? (
          <Banner title={loadError.title} detail={loadError.detail} action={{ label: 'Réessayer', onClick: onRetryLoad }} />
        ) : null}

        {streamError ? (
          <Banner
            title={streamError.title}
            detail={streamError.detail || undefined}
            action={streamError.retry ? { label: 'Réessayer', onClick: streamError.retry } : { label: 'Masquer', onClick: onDismissStreamError }}
          />
        ) : null}

        {loading ? (
          <div className="research-state">
            <Spinner size={16} />
            <strong>Chargement de la conversation…</strong>
          </div>
        ) : null}

        {empty ? (
          health && health.documents_count === 0 ? (
            <EmptyState
              title="Aucun document indexé"
              detail="La base est vide : importez un PDF, DOCX, XLSX ou CSV pour commencer à interroger vos documents."
              action={
                <button type="button" className="primary-button" onClick={onGoToDocuments}>
                  Importer un document
                </button>
              }
            />
          ) : (
            <EmptyState
              title="Interrogez votre base documentaire"
              detail={
                health
                  ? `${health.documents_count} document(s) et ${health.chunks_indexed} extrait(s) indexé(s). Chaque réponse cite les passages utilisés.`
                  : 'Connexion au serveur en cours…'
              }
            />
          )
        ) : null}

        {messages.map((message, index) =>
          message.role === 'user' ? (
            <div className="user-message" key={message.id}>
              {message.content}
            </div>
          ) : (
            <article className="answer" key={message.id}>
              <div className="answer-heading">
                <span className="assistant-mark">N</span>
                <span>
                  <strong>Nexus</strong>
                  <small>
                    {streaming && index === lastAssistantIndex && !message.content
                      ? 'Recherche dans la base…'
                      : streaming && index === lastAssistantIndex
                        ? 'Rédaction de la réponse…'
                        : assistantLabel(message.sources.length)}
                    {message.model ? ` · ${message.model}` : ''}
                  </small>
                </span>
              </div>

              {message.content ? (
                <div
                  className="answer-body"
                  onClick={handleAnswerClick}
                  dangerouslySetInnerHTML={{ __html: renderAnswer(message.content, message.sources) }}
                />
              ) : streaming && index === lastAssistantIndex ? (
                <div className="research-state">
                  <div className="skeleton-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="steps">
                    <span className={message.sources.length ? 'done' : 'current'}>
                      Recherche {message.sources.length ? `· ${message.sources.length} extrait(s)` : ''}
                    </span>
                    <span className={message.sources.length ? 'current' : ''}>Rédaction</span>
                  </div>
                </div>
              ) : (
                <p className="muted">Cette réponse est vide.</p>
              )}

              {message.content && !message.id.startsWith('local-') ? (
                <div className="answer-actions">
                  <IconButton label="Copier la réponse" onClick={() => onCopy(message.content)}>
                    <Clipboard size={16} />
                  </IconButton>
                  {questionBefore(index) && !streaming ? (
                    <IconButton
                      label="Relancer la question (nouvelle réponse enregistrée)"
                      onClick={() => onRegenerate(questionBefore(index) as string)}
                    >
                      <RefreshCw size={16} />
                    </IconButton>
                  ) : null}
                  <span />
                  <IconButton
                    label={message.feedback === 'up' ? 'Retirer le retour positif' : 'Réponse utile'}
                    onClick={() => onFeedback(message.id, 'up')}
                  >
                    <ThumbsUp size={16} style={message.feedback === 'up' ? { color: 'var(--blue)' } : undefined} />
                  </IconButton>
                  <IconButton
                    label={message.feedback === 'down' ? 'Retirer le retour négatif' : 'Réponse non utile'}
                    onClick={() => onFeedback(message.id, 'down')}
                  >
                    <ThumbsDown size={16} style={message.feedback === 'down' ? { color: 'var(--amber)' } : undefined} />
                  </IconButton>
                </div>
              ) : null}
            </article>
          ),
        )}
      </div>

      {children}
    </section>
  )
}

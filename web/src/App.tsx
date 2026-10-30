import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api, describeError } from './api/client'
import type { Conversation, DocumentList, DocumentRow, Health, KnowledgeBases, Source } from './api/types'
import { ChatView } from './components/ChatView'
import { CommandPalette } from './components/CommandPalette'
import { Composer } from './components/Composer'
import { DocumentDetail } from './components/DocumentDetail'
import { DocumentsView } from './components/DocumentsView'
import { Sidebar } from './components/Sidebar'
import { SourcesPanel } from './components/SourcesPanel'
import { Topbar } from './components/Topbar'
import { ConfirmDialog, ToastStack, type Notice, type NoticeKind } from './components/ui'
import { useChat } from './lib/useChat'

type View = 'chat' | 'documents'
type Theme = 'light' | 'dark'

type Deleting = { kind: 'conversation'; item: Conversation } | { kind: 'document'; item: DocumentRow }

function initialTheme(): Theme {
  const stored = window.localStorage.getItem('nexus-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [view, setView] = useState<View>('chat')
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(true)
  const [commandsOpen, setCommandsOpen] = useState(false)
  const [activeSource, setActiveSource] = useState<number | null>(null)

  const [health, setHealth] = useState<Health | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeBases | null>(null)
  const [category, setCategory] = useState<string | null>(null)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [conversationsError, setConversationsError] = useState<string | null>(null)

  const [documents, setDocuments] = useState<DocumentList | null>(null)
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | 'indexe' | 'en_attente' | 'erreur'>('')
  const [queryFilter, setQueryFilter] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [upload, setUpload] = useState<{ name: string } | null>(null)
  const [detail, setDetail] = useState<DocumentRow | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const [draft, setDraft] = useState('')
  const [notices, setNotices] = useState<Notice[]>([])
  const noticeId = useRef(0)
  const timers = useRef<number[]>([])

  const dismissNotice = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id))
  }, [])

  const pushNotice = useCallback(
    (kind: NoticeKind, title: string, detail?: string, action?: Notice['action']) => {
      noticeId.current += 1
      const id = noticeId.current
      setNotices((current) => [...current.slice(-3), { id, kind, title, detail, action }])
      const timer = window.setTimeout(() => dismissNotice(id), kind === 'error' ? 9000 : 5000)
      timers.current.push(timer)
    },
    [dismissNotice],
  )

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), [])

  // --- thème --------------------------------------------------------------
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('nexus-theme', theme)
  }, [theme])

  // --- santé et bases -----------------------------------------------------
  const refreshHealth = useCallback(async () => {
    try {
      const payload = await api.health()
      setHealth(payload)
      setHealthError(null)
    } catch (error) {
      const described = describeError(error)
      setHealthError(described.detail || described.title)
    }
  }, [])

  const refreshKnowledge = useCallback(async () => {
    try {
      setKnowledge(await api.knowledgeBases())
    } catch {
      setKnowledge(null)
    }
  }, [])

  const refreshConversations = useCallback(async () => {
    setConversationsLoading(true)
    try {
      const payload = await api.conversations()
      setConversations(payload.conversations)
      setConversationsError(null)
    } catch (error) {
      const described = describeError(error)
      setConversationsError(`${described.title} ${described.detail}`.trim())
    } finally {
      setConversationsLoading(false)
    }
  }, [])

  const refreshDocuments = useCallback(async () => {
    setDocumentsLoading(true)
    try {
      const payload = await api.documents({
        status: statusFilter || undefined,
        q: debouncedQuery || undefined,
        category: category || undefined,
      })
      setDocuments(payload)
      setDocumentsError(null)
    } catch (error) {
      const described = describeError(error)
      setDocumentsError(`${described.title} ${described.detail}`.trim())
    } finally {
      setDocumentsLoading(false)
    }
  }, [category, debouncedQuery, statusFilter])

  useEffect(() => {
    void refreshHealth()
    void refreshKnowledge()
    void refreshConversations()
  }, [refreshConversations, refreshHealth, refreshKnowledge])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(queryFilter), 250)
    return () => window.clearTimeout(timer)
  }, [queryFilter])

  useEffect(() => {
    void refreshDocuments()
  }, [refreshDocuments])

  // --- conversation -------------------------------------------------------
  const chat = useChat({
    category,
    onConversationTouched: () => {
      void refreshConversations()
    },
    onDraftRestored: (question) => setDraft(question),
    onNotice: (title, detail) => pushNotice('error', title, detail),
  })

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === chat.activeId) ?? null,
    [chat.activeId, conversations],
  )
  const contextLabel = category ?? 'Toutes les bases'

  const startNewConversation = useCallback(() => {
    chat.reset()
    setView('chat')
    setActiveSource(null)
    setSourcesOpen(true)
  }, [chat])

  const openConversation = useCallback(
    (id: string) => {
      setView('chat')
      setActiveSource(null)
      setSourcesOpen(true)
      void chat.load(id)
    },
    [chat],
  )

  const send = useCallback(() => {
    const question = draft.trim()
    if (!question || chat.streaming) return
    setDraft('')
    setActiveSource(null)
    setSourcesOpen(true)
    void chat.ask(question)
  }, [chat, draft])

  const copyAnswer = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        pushNotice('success', 'Réponse copiée dans le presse-papiers.')
      } catch {
        pushNotice('error', 'Copie impossible', 'Le navigateur a refusé l’accès au presse-papiers.')
      }
    },
    [pushNotice],
  )

  const openSourceDocument = useCallback(
    async (source: Source) => {
      try {
        const resolved = source.document_id ? source : await api.source(source.id)
        if (!resolved.document_id) {
          pushNotice('info', 'Document original indisponible', 'Cet extrait appartient à un index archivé : le fichier source n’est plus référencé.')
          return
        }
        window.open(`/api/documents/${resolved.document_id}/file`, '_blank', 'noopener')
      } catch (error) {
        const described = describeError(error)
        pushNotice('error', described.title, described.detail)
      }
    },
    [pushNotice],
  )

  // --- documents ----------------------------------------------------------
  const uploadFiles = useCallback(
    async (files: File[]) => {
      const target = category ?? 'Général'
      for (const file of files) {
        setUpload({ name: file.name })
        try {
          const document = await api.upload(file, target)
          pushNotice(
            'success',
            `${document.name} importé`,
            `${document.chunk_count} extrait(s) indexé(s) dans « ${document.category} ».`,
          )
        } catch (error) {
          const described = describeError(error)
          pushNotice(
            'error',
            described.title,
            `${file.name} — ${described.detail || described.title}`,
            described.retryable ? { label: 'Voir les documents', onClick: () => setView('documents') } : undefined,
          )
          // Un import en 503 laisse le document enregistré en erreur : on rafraîchit
          // quand même la liste pour que l'état réel soit visible.
          if (!(error instanceof ApiError && [413, 415, 422, 409].includes(error.status))) {
            void refreshDocuments()
          }
        } finally {
          setUpload(null)
        }
      }
      void refreshDocuments()
      void refreshKnowledge()
      void refreshHealth()
    },
    [category, pushNotice, refreshDocuments, refreshHealth, refreshKnowledge],
  )

  const reindexDocument = useCallback(
    async (document: DocumentRow) => {
      setDetailBusy(true)
      try {
        const updated = await api.reindexDocument(document.id)
        pushNotice('success', `${updated.name} réindexé`, `${updated.chunk_count} extrait(s) indexé(s).`)
        setDetail((current) => (current && current.id === updated.id ? updated : current))
        void refreshDocuments()
        void refreshKnowledge()
        void refreshHealth()
      } catch (error) {
        const described = describeError(error)
        pushNotice('error', described.title, described.detail)
        void refreshDocuments()
      } finally {
        setDetailBusy(false)
      }
    },
    [pushNotice, refreshDocuments, refreshHealth, refreshKnowledge],
  )

  const confirmDelete = useCallback(async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      if (deleting.kind === 'conversation') {
        await api.deleteConversation(deleting.item.id)
        if (chat.activeId === deleting.item.id) chat.reset()
        await refreshConversations()
        pushNotice('success', 'Conversation supprimée.')
      } else {
        await api.removeDocument(deleting.item.id)
        setDetail((current) => (current && current.id === deleting.item.id ? null : current))
        await refreshDocuments()
        void refreshKnowledge()
        void refreshHealth()
        pushNotice('success', `${deleting.item.name} supprimé de la base.`)
      }
      setDeleting(null)
    } catch (error) {
      const described = describeError(error)
      pushNotice('error', described.title, described.detail)
    } finally {
      setDeleteBusy(false)
    }
  }, [chat, deleting, pushNotice, refreshConversations, refreshDocuments, refreshHealth, refreshKnowledge])

  // --- raccourcis ---------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandsOpen((open) => !open)
      }
      if (event.key === 'Escape') {
        setCommandsOpen(false)
        setSidebarOpen(false)
        setDetail(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const composerDisabled = healthError !== null

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        close={() => setSidebarOpen(false)}
        view={view}
        onNavigate={setView}
        conversations={conversations}
        activeId={chat.activeId}
        onSelectConversation={openConversation}
        onNewConversation={startNewConversation}
        onDeleteConversation={(conversation) => setDeleting({ kind: 'conversation', item: conversation })}
        conversationsLoading={conversationsLoading}
        conversationsError={conversationsError}
        onRetryConversations={() => void refreshConversations()}
        knowledge={knowledge}
        category={category}
        onSelectCategory={setCategory}
        health={health}
        healthError={healthError}
        onOpenCommands={() => setCommandsOpen(true)}
      />
      {sidebarOpen ? <button type="button" className="drawer-backdrop" aria-label="Fermer le menu" onClick={() => setSidebarOpen(false)} /> : null}

      <main>
        <Topbar
          view={view}
          context={view === 'chat' ? (activeConversation?.title ?? 'Nouvelle conversation') : 'Documents'}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenCommands={() => setCommandsOpen(true)}
          onToggleSources={view === 'chat' ? () => setSourcesOpen((open) => !open) : null}
          sourcesOpen={sourcesOpen}
          health={health}
          healthError={healthError}
          onRetryHealth={() => void refreshHealth()}
        />

        {view === 'chat' ? (
          <div className="chat-layout">
            <ChatView
              title={activeConversation?.title ?? null}
              messages={chat.messages}
              sources={chat.sources}
              streaming={chat.streaming}
              loading={chat.loading}
              loadError={chat.loadError}
              streamError={chat.streamError}
              health={health}
              contextLabel={contextLabel}
              onRetryLoad={() => (chat.activeId ? void chat.load(chat.activeId) : undefined)}
              onDismissStreamError={() => chat.setStreamError(null)}
              onCopy={(text) => void copyAnswer(text)}
              onFeedback={(messageId, value) => void chat.sendFeedback(messageId, value)}
              onRegenerate={(question) => void chat.ask(question)}
              onSourceClick={(index) => {
                setSourcesOpen(true)
                setActiveSource(index)
              }}
              onGoToDocuments={() => setView('documents')}
            >
              <Composer
                value={draft}
                onChange={setDraft}
                onSend={send}
                onStop={chat.stop}
                streaming={chat.streaming}
                disabled={composerDisabled}
                category={category}
                onCategoryChange={setCategory}
                knowledge={knowledge}
                health={health}
                onAttach={(file) => {
                  setView('documents')
                  void uploadFiles([file])
                }}
              />
            </ChatView>

            <SourcesPanel
              open={sourcesOpen}
              close={() => setSourcesOpen(false)}
              sources={chat.sources}
              question={chat.lastQuestion ?? ''}
              activeIndex={activeSource}
              onSelect={setActiveSource}
              onOpenDocument={(source) => void openSourceDocument(source)}
            />
          </div>
        ) : (
          <DocumentsView
            documents={documents}
            loading={documentsLoading}
            error={documentsError}
            onRetry={() => void refreshDocuments()}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            query={queryFilter}
            onQueryChange={setQueryFilter}
            category={category}
            knowledge={knowledge}
            upload={upload}
            onUpload={(files) => void uploadFiles(files)}
            onOpenDocument={setDetail}
            onReindex={(document) => void reindexDocument(document)}
            onDelete={(document) => setDeleting({ kind: 'document', item: document })}
            onSelectCategory={setCategory}
          />
        )}
      </main>

      {commandsOpen ? (
        <CommandPalette
          onClose={() => setCommandsOpen(false)}
          onNewConversation={startNewConversation}
          onGoToDocuments={() => setView('documents')}
          onSelectConversation={openConversation}
          onOpenDocument={(document) => {
            setView('documents')
            setDetail(document)
          }}
        />
      ) : null}

      {detail ? (
        <DocumentDetail
          document={detail}
          busy={detailBusy}
          onClose={() => setDetail(null)}
          onReindex={(document) => void reindexDocument(document)}
          onDelete={(document) => {
            setDetail(null)
            setDeleting({ kind: 'document', item: document })
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={deleting.kind === 'conversation' ? 'Supprimer cette conversation ?' : 'Supprimer ce document ?'}
          detail={
            deleting.kind === 'conversation'
              ? `« ${deleting.item.title} » et tous ses messages seront définitivement supprimés.`
              : `« ${deleting.item.name} » sera retiré de la base, de l’index et du disque. Cette action est irréversible.`
          }
          confirmLabel="Supprimer"
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      <ToastStack notices={notices} dismiss={dismissNotice} />
    </div>
  )
}

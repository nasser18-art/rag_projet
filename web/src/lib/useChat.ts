import { useCallback, useEffect, useRef, useState } from 'react'
import { api, describeError, streamChat } from '../api/client'
import type { Message, Source } from '../api/types'

const LOCAL_USER = 'local-question'
const LOCAL_ANSWER = 'local-answer'

function localMessage(id: string, role: 'user' | 'assistant', content: string, sources: Source[] = []): Message {
  return {
    id,
    conversation_id: '',
    role,
    content,
    sources,
    model: null,
    feedback: null,
    created_at: new Date().toISOString(),
  }
}

type Options = {
  category: string | null
  onConversationTouched: (conversationId: string) => void
  onDraftRestored: (question: string) => void
  onNotice: (title: string, detail?: string) => void
}

/**
 * Tout l'état de la conversation : chargement, flux SSE, retour d'usage.
 * Aucune donnée de démonstration : le fil affiché vient du serveur ou du flux.
 */
export function useChat({ category, onConversationTouched, onDraftRestored, onNotice }: Options) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [title, setTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<{ title: string; detail: string } | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [streamError, setStreamError] = useState<{ title: string; detail: string; retry?: () => void } | null>(null)
  const [lastQuestion, setLastQuestion] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const categoryRef = useRef(category)
  const activeRef = useRef<string | null>(null)
  const streamingRef = useRef(false)

  useEffect(() => {
    categoryRef.current = category
  }, [category])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    streamingRef.current = false
    setStreaming(false)
  }, [])

  const load = useCallback(
    async (conversationId: string) => {
      stop()
      activeRef.current = conversationId
      setActiveId(conversationId)
      setMessages([])
      setSources([])
      setLoadError(null)
      setStreamError(null)
      setLoading(true)
      try {
        const conversation = await api.conversation(conversationId)
        if (activeRef.current !== conversationId) return
        setMessages(conversation.messages ?? [])
        setTitle(conversation.title)
        const lastAssistant = [...(conversation.messages ?? [])].reverse().find((message) => message.role === 'assistant')
        setSources(lastAssistant?.sources ?? [])
      } catch (error) {
        if (activeRef.current !== conversationId) return
        const described = describeError(error)
        setLoadError({ title: described.title, detail: described.detail })
      } finally {
        if (activeRef.current === conversationId) setLoading(false)
      }
    },
    [stop],
  )

  const reset = useCallback(() => {
    stop()
    activeRef.current = null
    setActiveId(null)
    setMessages([])
    setSources([])
    setTitle(null)
    setLoadError(null)
    setStreamError(null)
    setLastQuestion(null)
  }, [stop])

  const ask = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim()
      if (!question || streamingRef.current) return

      const controller = new AbortController()
      abortRef.current = controller
      streamingRef.current = true
      setStreaming(true)
      setStreamError(null)
      setLastQuestion(question)
      setMessages((current) => [
        ...current,
        localMessage(LOCAL_USER, 'user', question),
        localMessage(LOCAL_ANSWER, 'assistant', ''),
      ])

      let receivedSources = false
      let receivedTokens = false

      try {
        await streamChat(
          { question, conversationId: activeRef.current, category: categoryRef.current },
          {
            onSources: (incoming, conversationId) => {
              receivedSources = true
              setSources(incoming)
              setMessages((current) =>
                current.map((message) =>
                  message.id === LOCAL_ANSWER ? { ...message, sources: incoming } : message,
                ),
              )
              if (conversationId) {
                activeRef.current = conversationId
                setActiveId(conversationId)
                onConversationTouched(conversationId)
              }
            },
            onToken: (token) => {
              receivedTokens = true
              setMessages((current) =>
                current.map((message) =>
                  message.id === LOCAL_ANSWER ? { ...message, content: message.content + token } : message,
                ),
              )
            },
            onDone: (conversationId) => {
              if (conversationId) onConversationTouched(conversationId)
            },
          },
          controller.signal,
        )

        const conversationId = activeRef.current
        if (conversationId) {
          // Relecture de la conversation persistée : les identifiants et le
          // contenu affichés sont alors ceux du serveur, pas ceux du flux.
          try {
            const conversation = await api.conversation(conversationId)
            if (activeRef.current === conversationId) {
              setMessages(conversation.messages ?? [])
              setTitle(conversation.title)
            }
          } catch {
            /* le flux a réussi : on garde l'affichage local */
          }
        }
      } catch (error) {
        const described = describeError(error)
        if (error instanceof DOMException && error.name === 'AbortError') {
          setMessages((current) => current.filter((message) => message.id !== LOCAL_ANSWER || message.content.length > 0))
          if (activeRef.current) {
            try {
              const conversation = await api.conversation(activeRef.current)
              setMessages(conversation.messages ?? [])
            } catch {
              /* l'utilisateur a arrêté : le partiel local reste affiché */
            }
          }
          return
        }

        if (!receivedSources && !receivedTokens) {
          // Rien n'a été créé côté serveur : on rend la question au compositeur.
          setMessages((current) =>
            current.filter((message) => message.id !== LOCAL_USER && message.id !== LOCAL_ANSWER),
          )
          setSources([])
          onDraftRestored(question)
          setStreamError({
            title: described.title,
            detail: described.detail,
            retry: () => {
              setStreamError(null)
              void ask(question)
            },
          })
        } else {
          setStreamError({ title: described.title, detail: described.detail })
          const conversationId = activeRef.current
          if (conversationId) {
            try {
              const conversation = await api.conversation(conversationId)
              setMessages(conversation.messages ?? [])
            } catch {
              /* on garde le partiel */
            }
          }
        }
      } finally {
        abortRef.current = null
        streamingRef.current = false
        setStreaming(false)
      }
    },
    [onConversationTouched, onDraftRestored],
  )

  const sendFeedback = useCallback(
    async (messageId: string, value: 'up' | 'down') => {
      const current = messages.find((message) => message.id === messageId)
      const next = current?.feedback === value ? null : value
      setMessages((items) => items.map((item) => (item.id === messageId ? { ...item, feedback: next } : item)))
      try {
        await api.feedback(messageId, next)
      } catch (error) {
        const described = describeError(error)
        setMessages((items) => items.map((item) => (item.id === messageId ? { ...item, feedback: current?.feedback ?? null } : item)))
        onNotice(described.title, described.detail)
      }
    },
    [messages, onNotice],
  )

  useEffect(() => () => abortRef.current?.abort(), [])

  return {
    activeId,
    title,
    messages,
    sources,
    setSources,
    loading,
    loadError,
    streaming,
    streamError,
    lastQuestion,
    load,
    reset,
    ask,
    stop,
    sendFeedback,
    setStreamError,
  }
}

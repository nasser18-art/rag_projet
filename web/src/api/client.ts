/** Seule couche qui connaît les routes. Aucun composant ne fait de fetch. */

import type {
  Conversation,
  DocumentList,
  DocumentRow,
  Health,
  KnowledgeBases,
  SearchResults,
} from './types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) {
    let detail = ''
    try {
      const payload = await response.json()
      detail = typeof payload?.detail === 'string' ? payload.detail : ''
    } catch {
      /* corps non JSON */
    }
    throw new ApiError(detail || `La requête a échoué (${response.status}).`, response.status)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Message lisible pour chaque famille d'échec, sans jargon technique. */
export function describeError(error: unknown): { title: string; detail: string; retryable: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return {
        title: 'Le service documentaire n’est pas prêt',
        detail: `${error.message} Vérifiez qu’au moins un document est indexé et que la clé du modèle est configurée.`,
        retryable: true,
      }
    }
    if (error.status === 502) {
      return {
        title: 'Le service de réponse est indisponible',
        detail: `${error.message} Réessayez dans un instant.`,
        retryable: true,
      }
    }
    if (error.status === 404) return { title: 'Introuvable', detail: error.message, retryable: false }
    if (error.status === 413) return { title: 'Fichier trop volumineux', detail: error.message, retryable: false }
    if (error.status === 415) return { title: 'Format non pris en charge', detail: error.message, retryable: false }
    if (error.status === 409) return { title: 'Doublon', detail: error.message, retryable: false }
    if (error.status === 422) return { title: 'Demande invalide', detail: error.message, retryable: false }
    return { title: 'La requête a échoué', detail: error.message, retryable: true }
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { title: 'Génération arrêtée', detail: '', retryable: false }
  }
  return {
    title: 'Connexion interrompue',
    detail: 'Le serveur ne répond pas. Vérifiez qu’il est lancé, puis réessayez.',
    retryable: true,
  }
}

export const api = {
  health: () => request<Health>('/api/health'),

  documents: (params: { status?: string; q?: string; category?: string } = {}) => {
    const search = new URLSearchParams()
    if (params.status) search.set('status', params.status)
    if (params.q) search.set('q', params.q)
    if (params.category) search.set('category', params.category)
    const query = search.toString()
    return request<DocumentList>(`/api/documents${query ? `?${query}` : ''}`)
  },

  upload: (file: File, category: string, onProgressLabel?: (label: string) => void) => {
    const body = new FormData()
    body.append('file', file)
    body.append('category', category)
    onProgressLabel?.('Envoi du fichier…')
    return request<DocumentRow>('/api/documents', { method: 'POST', body })
  },

  removeDocument: (id: string) => request<void>(`/api/documents/${id}`, { method: 'DELETE' }),

  reindexDocument: (id: string) => request<DocumentRow>(`/api/documents/${id}/reindex`, { method: 'POST' }),

  documentFileUrl: (id: string) => `/api/documents/${id}/file`,

  knowledgeBases: () => request<KnowledgeBases>('/api/knowledge-bases'),

  source: (id: string) => request<import('./types').Source>(`/api/sources/${encodeURIComponent(id)}`),

  conversations: () => request<{ conversations: Conversation[] }>('/api/conversations'),

  conversation: (id: string) => request<Conversation>(`/api/conversations/${id}`),

  createConversation: (title?: string, category?: string | null) =>
    request<Conversation>('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title?.trim() || 'Nouvelle conversation', category: category || null }),
    }),

  renameConversation: (id: string, title: string) =>
    request<Conversation>(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }),

  deleteConversation: (id: string) => request<void>(`/api/conversations/${id}`, { method: 'DELETE' }),

  feedback: (messageId: string, feedback: 'up' | 'down' | null) =>
    request<void>(`/api/messages/${messageId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    }),

  search: (q: string) => request<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`),
}

export type StreamHandlers = {
  onSources?: (sources: import('./types').Source[], conversationId: string | null) => void
  onToken?: (token: string) => void
  onDone?: (conversationId: string, messageId: string) => void
}

/**
 * Ouvre le flux SSE de /api/chat et dispatche les trames.
 * Les erreurs métier du flux remontent par l'exception levée dans le reader.
 */
export async function streamChat(
  payload: { question: string; conversationId: string | null; category: string | null },
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      question: payload.question,
      stream: true,
      conversation_id: payload.conversationId,
      category: payload.category,
    }),
    signal,
  })

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = typeof body?.detail === 'string' ? body.detail : ''
    } catch {
      /* ignore */
    }
    throw new ApiError(detail || 'Le service de réponse est indisponible.', response.status)
  }
  if (!response.body) throw new ApiError('Ce navigateur ne sait pas lire une réponse en flux.', 0)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const line = block.split('\n').find((candidate) => candidate.startsWith('data: '))
      if (!line) continue
      let event: Record<string, unknown>
      try {
        event = JSON.parse(line.slice(6))
      } catch {
        continue
      }
      if (event.type === 'sources') {
        handlers.onSources?.((event.sources as import('./types').Source[]) ?? [], (event.conversation_id as string) ?? null)
      } else if (event.type === 'token') {
        handlers.onToken?.(String(event.content ?? ''))
      } else if (event.type === 'done') {
        handlers.onDone?.(String(event.conversation_id ?? ''), String(event.message_id ?? ''))
      } else if (event.type === 'error') {
        throw new ApiError(String(event.message ?? 'La réponse a été interrompue.'), 502)
      }
    }
  }
}

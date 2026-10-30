/** Types partagés avec l'API FastAPI (voir app.py). */

export type Health = {
  status: 'ok' | 'degraded'
  knowledge_base_ready: boolean
  llm_configured: boolean
  model: string
  documents_count: number
  chunks_indexed: number
  uploads_enabled: boolean
  formats: string[]
  max_upload_bytes: number
}

export type Source = {
  id: string
  document: string
  category: string
  chunk_id: number
  excerpt: string
  score: number | null
  page: string | null
  document_id?: string | null
}

export type DocumentRow = {
  id: string
  name: string
  category: string
  ext: string
  size_bytes: number
  pages: number | null
  chunk_count: number
  status: 'en_attente' | 'indexe' | 'erreur'
  error: string | null
  created_at: string
  indexed_at: string | null
}

export type DocumentList = {
  documents: DocumentRow[]
  total: number
  counts: { all: number; indexe: number; en_attente: number; erreur: number }
}

export type KnowledgeBases = {
  categories: { name: string; documents: number; indexed: number; chunks: number }[]
  formats: string[]
  max_upload_bytes: number
}

export type Message = {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  sources: Source[]
  model: string | null
  feedback: 'up' | 'down' | null
  created_at: string
}

export type Conversation = {
  id: string
  title: string
  category: string | null
  created_at: string
  updated_at: string
  messages?: Message[]
}

export type SearchResults = {
  documents: DocumentRow[]
  conversations: Conversation[]
}

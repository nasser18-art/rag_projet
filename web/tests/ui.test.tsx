import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { ChatView } from '../src/components/ChatView'
import { Composer } from '../src/components/Composer'
import { Sidebar } from '../src/components/Sidebar'
import { formatBytes, groupByDay, renderAnswer } from '../src/lib/format'
import type { Conversation, Health, Message, Source } from '../src/api/types'

const sources: Source[] = [
  {
    id: 'doc1:0',
    document: 'Contrat Atlas.pdf',
    category: 'Juridique',
    chunk_id: 0,
    excerpt: 'Chaque partie peut résilier le contrat avec un préavis de 90 jours.',
    score: 0.84,
    page: 'Page 12',
    document_id: 'doc1',
  },
  {
    id: 'doc2:3',
    document: 'Politique fournisseurs.docx',
    category: 'Achats',
    chunk_id: 3,
    excerpt: 'Toute résiliation doit être validée par la direction juridique.',
    score: 0.72,
    page: 'Section 4.2',
  },
]

const message: Message = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  role: 'assistant',
  content: 'Le préavis est de 90 jours. **Point clé** [1] et validation juridique [2].',
  sources,
  model: 'openai/gpt-oss-20b',
  feedback: null,
  created_at: '2026-01-05T10:00:00Z',
}

const health: Health = {
  status: 'degraded',
  knowledge_base_ready: false,
  llm_configured: false,
  model: 'openai/gpt-oss-20b',
  documents_count: 2,
  chunks_indexed: 12,
  uploads_enabled: true,
  formats: ['pdf', 'docx', 'csv', 'xlsx'],
  max_upload_bytes: 26214400,
}

const conversations: Conversation[] = [
  { id: 'conv-1', title: 'Résiliation contrat Atlas', category: 'Juridique', created_at: '2026-01-05T10:00:00Z', updated_at: new Date().toISOString() },
]

describe('formatage', () => {
  it('formate les tailles en français', () => {
    expect(formatBytes(512)).toBe('512 o')
    expect(formatBytes(2048)).toBe('2 Ko')
    expect(formatBytes(2_516_582)).toBe('2,4 Mo')
  })

  it('regroupe les conversations par ancienneté', () => {
    const groups = groupByDay([
      { updated_at: new Date().toISOString() },
      { updated_at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    ])
    expect(groups.map((group) => group.label)).toEqual(['Aujourd’hui', 'Cette semaine'])
  })
})

describe('rendu des réponses', () => {
  it('transforme les renvois [n] en boutons liés aux sources', () => {
    const html = renderAnswer('Préavis de 90 jours [1].', sources)
    expect(html).toContain('data-source-index="1"')
    expect(html).toContain('Contrat Atlas.pdf')
    expect(html).toContain('Pertinence 84 %')
    expect(html).toContain('aria-label="Afficher la source 1"')
  })

  it('signale un renvoi sans extrait correspondant', () => {
    const html = renderAnswer('Affirmation [7].', sources)
    expect(html).toContain('Aucun extrait ne correspond à ce renvoi.')
  })

  it('échappe le balisage du modèle', () => {
    const html = renderAnswer('<script>alert(1)</script> **gras**', sources)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<strong>gras</strong>')
  })
})

describe('composants', () => {
  it('affiche une réponse avec ses sources, son modèle et ses actions', () => {
    const html = renderToString(
      createElement(ChatView, {
        title: 'Résiliation contrat Atlas',
        messages: [message],
        sources,
        streaming: false,
        loading: false,
        loadError: null,
        streamError: null,
        health,
        contextLabel: 'Juridique',
        onRetryLoad: () => undefined,
        onDismissStreamError: () => undefined,
        onCopy: () => undefined,
        onFeedback: () => undefined,
        onRegenerate: () => undefined,
        onSourceClick: () => undefined,
        onGoToDocuments: () => undefined,
      }),
    )
    expect(html).toContain('Résiliation contrat Atlas')
    expect(html).toContain('Le préavis est de 90 jours')
    expect(html).toContain('data-source-index="1"')
    expect(html).toContain('openai/gpt-oss-20b')
    expect(html).toContain('Copier la réponse')
    expect(html).toContain('Réponse utile')
  })

  it('affiche l’erreur de flux sans la masquer', () => {
    const html = renderToString(
      createElement(ChatView, {
        title: null,
        messages: [],
        sources: [],
        streaming: false,
        loading: false,
        loadError: null,
        streamError: { title: 'Le service documentaire n’est pas prêt', detail: 'Aucun document indexé.' },
        health,
        contextLabel: 'Toutes les bases',
        onRetryLoad: () => undefined,
        onDismissStreamError: () => undefined,
        onCopy: () => undefined,
        onFeedback: () => undefined,
        onRegenerate: () => undefined,
        onSourceClick: () => undefined,
        onGoToDocuments: () => undefined,
      }),
    )
    expect(html).toContain('Le service documentaire n’est pas prêt')
    expect(html).toContain('Aucun document indexé.')
  })

  it('liste le modèle réel et les bases disponibles dans le compositeur', () => {
    const html = renderToString(
      createElement(Composer, {
        value: '',
        onChange: () => undefined,
        onSend: () => undefined,
        onStop: () => undefined,
        streaming: false,
        disabled: false,
        category: 'Juridique',
        onCategoryChange: () => undefined,
        knowledge: {
          categories: [{ name: 'Juridique', documents: 3, indexed: 2, chunks: 10 }],
          formats: ['pdf', 'csv'],
          max_upload_bytes: 26214400,
        },
        health,
        onAttach: () => undefined,
      }),
    )
    expect(html).toContain('openai/gpt-oss-20b')
    expect(html).toContain('clé absente')
    expect(html).toContain('value="Juridique" selected')
    expect(html).toContain('PDF, CSV jusqu’à 25,0 Mo')
  })

  it('affiche les conversations et les bases réelles dans la barre latérale', () => {
    const html = renderToString(
      createElement(Sidebar, {
        open: false,
        close: () => undefined,
        view: 'chat',
        onNavigate: () => undefined,
        conversations,
        activeId: 'conv-1',
        onSelectConversation: () => undefined,
        onNewConversation: () => undefined,
        onDeleteConversation: () => undefined,
        conversationsLoading: false,
        conversationsError: null,
        onRetryConversations: () => undefined,
        knowledge: {
          categories: [{ name: 'Juridique', documents: 3, indexed: 2, chunks: 10 }],
          formats: ['pdf'],
          max_upload_bytes: 1,
        },
        category: 'Juridique',
        onSelectCategory: () => undefined,
        health,
        healthError: null,
        onOpenCommands: () => undefined,
      }),
    )
    expect(html).toContain('Résiliation contrat Atlas')
    expect(html).toContain('Supprimer « Résiliation contrat Atlas »')
    expect(html).toContain('Juridique')
    expect(html).toContain('Base incomplète')
  })
})

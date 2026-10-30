import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, streamChat } from '../src/api/client'

function sseResponse(frames: string[], chunkSize = 64): Response {
  const body = frames.join('')
  const bytes = new TextEncoder().encode(body)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        controller.enqueue(bytes.slice(offset, offset + chunkSize))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const frame = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`

describe('lecture du flux SSE', () => {
  it('dispatche sources, jetons et fin de réponse', async () => {
    const conversation = 'conv-1'
    const fetchMock = vi.fn(async () =>
      sseResponse(
        [
          frame({ type: 'sources', conversation_id: conversation, sources: [
            { id: 'doc1:0', document: 'Contrat Atlas.pdf', category: 'Juridique', chunk_id: 0,
              excerpt: 'Préavis de 90 jours — résiliation.', score: 0.87, page: 'Page 12' },
          ] }),
          frame({ type: 'token', content: 'Le préavis ' }),
          frame({ type: 'token', content: 'est de 90 jours.' }),
          frame({ type: 'done', conversation_id: conversation, message_id: 'msg-9' }),
        ],
        7,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const events: string[] = []
    let answer = ''
    let sourcesCount = 0

    await streamChat(
      { question: 'Quel préavis ?', conversationId: null, category: 'Juridique' },
      {
        onSources: (sources, id) => {
          sourcesCount = sources.length
          events.push(`sources:${id}:${sources[0].page}`)
        },
        onToken: (token) => {
          answer += token
        },
        onDone: (id, messageId) => {
          events.push(`done:${id}:${messageId}`)
        },
      },
      new AbortController().signal,
    )

    expect(sourcesCount).toBe(1)
    expect(answer).toBe('Le préavis est de 90 jours.')
    expect(events).toEqual(['sources:conv-1:Page 12', 'done:conv-1:msg-9'])

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toEqual({
      question: 'Quel préavis ?',
      stream: true,
      conversation_id: null,
      category: 'Juridique',
    })
  })

  it('remonte le détail d’une erreur HTTP avant le flux', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "Le service documentaire n'est pas encore configuré." }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      streamChat({ question: 'Test', conversationId: null, category: null }, {}, new AbortController().signal),
    ).rejects.toMatchObject({ status: 503, message: "Le service documentaire n'est pas encore configuré." })
  })

  it('interrompt la lecture sur une trame d’erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([frame({ type: 'error', message: 'La réponse a été interrompue.' })])))

    await expect(
      streamChat({ question: 'Test', conversationId: null, category: null }, {}, new AbortController().signal),
    ).rejects.toBeInstanceOf(ApiError)
  })
})

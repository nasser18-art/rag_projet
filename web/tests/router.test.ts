import { describe, expect, it } from 'vitest'
import { parseRoute, routeToPath } from '../src/lib/router'

describe('routes de l’interface', () => {
  it('reconnaît les chemins servis par FastAPI', () => {
    expect(parseRoute('/')).toEqual({ name: 'chat' })
    expect(parseRoute('/documents')).toEqual({ name: 'documents' })
    expect(parseRoute('/documents/')).toEqual({ name: 'documents' })
    expect(parseRoute('/conversations/8f502062266f48929ecb8fab05e59114')).toEqual({
      name: 'conversation',
      id: '8f502062266f48929ecb8fab05e59114',
    })
  })

  it('retombe sur la conversation vierge pour un chemin inconnu', () => {
    expect(parseRoute('/inconnu')).toEqual({ name: 'chat' })
    expect(parseRoute('/conversations/')).toEqual({ name: 'chat' })
    expect(parseRoute('/conversations/a/b')).toEqual({ name: 'chat' })
  })

  it('produit l’URL correspondant à chaque route', () => {
    expect(routeToPath({ name: 'chat' })).toBe('/')
    expect(routeToPath({ name: 'documents' })).toBe('/documents')
    expect(routeToPath({ name: 'conversation', id: 'abc-1' })).toBe('/conversations/abc-1')
    expect(parseRoute(routeToPath({ name: 'documents' }))).toEqual({ name: 'documents' })
  })
})

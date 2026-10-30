import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import App from '../src/App'

// Rendu serveur de l'application complète : les effets (réseau, thème) ne sont
// pas exécutés, seules les branches de rendu initiales sont vérifiées. Cela
// garantit qu'aucun composant ne casse au montage avec des données absentes.
const makeWindow = (pathname: string) => ({
  location: { pathname },
  history: { pushState: () => undefined, replaceState: () => undefined },
  localStorage: { getItem: () => null, setItem: () => undefined },
  matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  setTimeout: () => 0,
  clearTimeout: () => undefined,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('montage de l’application', () => {
  it('affiche l’état initial vide sans données serveur', () => {
    vi.stubGlobal('window', makeWindow('/'))
    const html = renderToString(createElement(App))

    expect(html).toContain('Nexus')
    expect(html).toContain('Nouvelle conversation')
    expect(html).toContain('Conversations')
    expect(html).toContain('Documents')
    expect(html).toContain('Vérification…')
    expect(html).toContain('Interrogez votre base documentaire')
    expect(html).toContain('Chargement de l’historique…')
    expect(html).toContain('Connexion au serveur…')
    expect(html).toContain('Toutes les bases')
    // Aucune donnée de démonstration ne doit subsister dans le rendu initial.
    expect(html).not.toContain('Contrat fournisseur Atlas')
    expect(html).not.toContain('Alex Martin')
    expect(html).not.toContain('96%')
  })

  it('ouvre la vue Documents depuis l’URL /documents', () => {
    vi.stubGlobal('window', makeWindow('/documents'))
    const html = renderToString(createElement(App))

    expect(html).toContain('BASE DE CONNAISSANCES')
    expect(html).toContain('Ajouter des documents')
    expect(html).toContain('Déposez vos fichiers ici')
    expect(html).not.toContain('Interrogez votre base documentaire')
  })
})

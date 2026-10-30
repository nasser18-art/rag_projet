/** Routes de l'interface : elles survivent au rafraîchissement du navigateur. */

export type Route = { name: 'chat' } | { name: 'documents' } | { name: 'conversation'; id: string }

export function parseRoute(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || '/'
  if (clean === '/documents') return { name: 'documents' }
  const match = /^\/conversations\/([\w-]+)$/.exec(clean)
  if (match) return { name: 'conversation', id: match[1] }
  return { name: 'chat' }
}

export function routeToPath(route: Route): string {
  if (route.name === 'documents') return '/documents'
  if (route.name === 'conversation') return `/conversations/${route.id}`
  return '/'
}

/** Change l'URL sans recharger la page ; le serveur renvoie la même application. */
export function writeRoute(route: Route, replace = false): void {
  const next = routeToPath(route)
  if (next === window.location.pathname) return
  if (replace) window.history.replaceState({}, '', next)
  else window.history.pushState({}, '', next)
}

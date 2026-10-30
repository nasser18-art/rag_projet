/** Formatage et rendu sûr : aucune donnée n'est injectée en HTML. */

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${bytes} o`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Regroupement de l'historique, comme dans le template : Aujourd'hui / Hier / Cette semaine. */
export function groupByDay<T extends { updated_at: string }>(items: T[]): { label: string; items: T[] }[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const groups: { label: string; items: T[] }[] = [
    { label: "Aujourd’hui", items: [] },
    { label: 'Hier', items: [] },
    { label: 'Cette semaine', items: [] },
    { label: 'Plus ancien', items: [] },
  ]

  for (const item of items) {
    const date = new Date(item.updated_at)
    const time = Number.isNaN(date.getTime()) ? 0 : date.getTime()
    if (time >= startOfToday) groups[0].items.push(item)
    else if (time >= startOfToday - 86_400_000) groups[1].items.push(item)
    else if (time >= startOfToday - 6 * 86_400_000) groups[2].items.push(item)
    else groups[3].items.push(item)
  }
  return groups.filter((group) => group.items.length > 0)
}

export function statusLabel(status: string): string {
  if (status === 'indexe') return 'Indexé'
  if (status === 'en_attente') return 'En attente'
  if (status === 'erreur') return 'Erreur'
  return status
}

export function relativeScore(score: number | null): string {
  if (score === null || Number.isNaN(score)) return ''
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)} %`
}

/** Échappe puis applique un markdown minimal (gras, code, listes, paragraphes). */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] as string,
  )
}

type SourceLike = { document: string; page: string | null; score: number | null; excerpt: string }

function citationMarkup(index: number, sources: SourceLike[] | null): string {
  const source = sources?.[index - 1]
  const body = source
    ? `<strong>${escapeHtml(source.document)}</strong>` +
      `<small>${escapeHtml(source.page ?? 'Extrait')}${source.score === null ? '' : ` · Pertinence ${relativeScore(source.score)}`}</small>` +
      `<span>« ${escapeHtml(source.excerpt)} »</span>`
    : '<small>Aucun extrait ne correspond à ce renvoi.</small>'
  return (
    `<span class="citation-wrap">` +
    `<button type="button" class="citation" data-source-index="${index}" aria-label="Afficher la source ${index}">[${index}]</button>` +
    `<span class="citation-popover" role="tooltip">${body}</span>` +
    `</span>`
  )
}

function markdown(text: string, sources: SourceLike[] | null): string {
  const inline = (value: string) => {
    const escaped = escapeHtml(value)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    if (!sources) return escaped
    return escaped.replace(/\[(\d{1,2})\]/g, (_match, digits: string) => citationMarkup(Number(digits), sources))
  }

  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((raw) => {
      const block = raw.trim()
      if (!block) return ''
      const lines = block.split('\n')
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`
      }
      if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
        return `<ol>${lines.map((line) => `<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`
      }
      if (/^#{1,3}\s+/.test(block) && lines.length === 1) {
        return `<h2>${inline(block.replace(/^#{1,3}\s+/, ''))}</h2>`
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`
    })
    .join('')
}

/** Texte utilisateur : échappé, sans interprétation. */
export function renderMarkdown(text: string): string {
  return markdown(text, null)
}

/** Réponse de l'assistant : markdown minimal + renvois [n] cliquables vers les sources. */
export function renderAnswer(text: string, sources: SourceLike[]): string {
  return markdown(text, sources)
}

const STOPWORDS = new Set(['les', 'des', 'une', 'que', 'qui', 'pour', 'dans', 'sur', 'avec', 'est', 'sont', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'quoi'])

/** Entoure dans l'extrait les mots significatifs de la question (jamais en HTML). */
export function highlightTerms(text: string, question: string): { start: number; end: number }[] {
  const words = (question.match(/[\p{L}\p{N}]{4,}/gu) ?? [])
    .map((word) => word.toLowerCase())
    .filter((word) => !STOPWORDS.has(word))
  if (!words.length) return []

  const ranges: { start: number; end: number }[] = []
  const haystack = text.toLowerCase()
  for (const word of new Set(words)) {
    let index = haystack.indexOf(word)
    while (index !== -1) {
      ranges.push({ start: index, end: index + word.length })
      index = haystack.indexOf(word, index + word.length)
    }
  }
  return ranges
    .sort((a, b) => a.start - b.start)
    .slice(0, 24)
}

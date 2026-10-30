/* Couche réseau — seule partie du frontend qui connaît les routes.
 *
 * Contrat serveur (figé, app.py ne doit pas changer) :
 *   POST /api/chat            {question, stream:true} → SSE
 *                             data: {"type":"sources","sources":[...]}
 *                             data: {"type":"token","content":"…"}
 *                             data: {"type":"done"}
 *                             data: {"type":"error","message":"…"}
 *   GET  /api/sources/{id}    → {id, document, category, chunk_id, excerpt, score}
 *   GET  /api/health          → {status, knowledge_base_ready, llm_configured, model}
 */

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const GENERIC_OFFLINE = 'Connexion interrompue. Vérifiez le réseau puis réessayez.';

/** Message lisible pour chaque famille d'échec (writing.md › Write clear error messages). */
export function describeFailure(error) {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return {
        title: 'Le service n’est pas encore configuré',
        detail: 'L’index documentaire ou la clé du modèle de réponse est absent côté serveur. '
          + 'Un administrateur doit indexer les documents, puis l’application répondra.',
      };
    }
    if (error.status === 502) {
      return {
        title: 'Le service de réponse ne répond pas',
        detail: 'La recherche a échoué en amont. Réessayez dans un instant ; si cela persiste, '
          + 'signalez l’incident avec l’heure de la tentative.',
      };
    }
    if (error.status === 404) {
      return { title: 'Extrait introuvable', detail: 'Ce document n’est plus dans l’index.' };
    }
    if (error.status === 422) {
      return { title: 'Question non acceptée', detail: 'Reformulez la question : elle est vide ou trop longue.' };
    }
    return { title: 'La requête a échoué', detail: error.message || GENERIC_OFFLINE };
  }
  if (error && error.name === 'AbortError') {
    return { title: 'Génération arrêtée', detail: '' };
  }
  return { title: 'Connexion interrompue', detail: GENERIC_OFFLINE };
}

async function readDetail(response) {
  try {
    const payload = await response.json();
    if (payload && typeof payload.detail === 'string') return payload.detail;
    if (payload && Array.isArray(payload.detail) && payload.detail[0]?.msg) return payload.detail[0].msg;
  } catch {
    /* corps non JSON : on garde le message générique */
  }
  return '';
}

export async function getHealth({ signal } = {}) {
  const response = await fetch('/api/health', { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new ApiError(await readDetail(response) || 'État du service indisponible.', response.status);
  return response.json();
}

export async function getSource(id, { signal } = {}) {
  const response = await fetch('/api/sources/' + encodeURIComponent(id), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new ApiError(await readDetail(response) || 'Extrait indisponible.', response.status);
  return response.json();
}

/**
 * Ouvre le flux SSE et dispatche les événements.
 * Ne lève pas pour les erreurs métier du flux : elles arrivent par `onError`.
 *
 * @param {string} question
 * @param {{signal?: AbortSignal, onSources?: Function, onToken?: Function,
 *          onDone?: Function, onError?: Function}} handlers
 */
export async function streamChat(question, handlers = {}) {
  const { signal, onSources = () => {}, onToken = () => {}, onDone = () => {}, onError = () => {} } = handlers;

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ question, stream: true }),
    signal,
  });

  if (!response.ok) {
    throw new ApiError(await readDetail(response) || 'Le service de réponse est indisponible.', response.status);
  }
  if (!response.body) {
    throw new ApiError('Ce navigateur ne sait pas lire une réponse en flux.', 0);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const line = block.split('\n').find((candidate) => candidate.startsWith('data: '));
      if (!line) continue;

      let payload;
      try {
        payload = JSON.parse(line.slice(6));
      } catch {
        continue; // trame illisible : on ignore plutôt que de casser le flux
      }

      if (payload.type === 'sources' && Array.isArray(payload.sources)) onSources(payload.sources);
      else if (payload.type === 'token' && typeof payload.content === 'string') onToken(payload.content);
      else if (payload.type === 'error') onError(new Error(payload.message || 'La réponse a été interrompue.'));
      else if (payload.type === 'done') onDone();
    }
  }
}

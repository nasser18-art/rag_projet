/* Orchestration de l'interface.
 * Modules ES, aucune dépendance. Le backend n'est jamais modifié : ce fichier
 * ne connaît que les trois routes décrites dans js/api.js.
 */

import { getHealth, getSource, streamChat, describeFailure } from './api.js';
import {
  el, buildMessage, buildTyping, buildSkeletons, buildProof, buildMessageTools,
  buildError, renderMarkdown, Sheet, icon,
} from './ui.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const dom = {
  topbar: $('#topbar'),
  status: $('#status'),
  statusLabel: $('#status-label'),
  thread: $('#thread'),
  welcome: $('#welcome'),
  composer: $('#composer'),
  composerWrap: $('.composer-wrap'),
  input: $('#question'),
  send: $('#send'),
  stop: $('#stop'),
  count: $('#count'),
  live: $('#live'),
  scrim: $('#scrim'),
  sheet: $('#sheet'),
  sheetBody: $('#sheet-body'),
  sheetTitle: $('#sheet-title'),
  sheetKicker: $('#sheet-kicker'),
  sheetClose: $('#sheet-close'),
  grabber: $('#sheet-grabber'),
  openHistory: $('#open-history'),
  newChat: $('#new-chat'),
};

const STORAGE_KEY = 'assistant-documentaire.historique.v1';
const MAX_STORED = 40;
const COUNT_THRESHOLD = 3500;
const MAX_LENGTH = Number(dom.input.getAttribute('maxlength')) || 4000;

const state = {
  controller: null,
  busy: false,
  messages: [],   // { role, text, sources, index }
  restore: false,
};

/* -------------------------------------------------------------------------- */
/* Annonces et défilement                                                     */
/* -------------------------------------------------------------------------- */

function announce(text) {
  if (!dom.live) return;
  dom.live.textContent = '';
  window.setTimeout(() => { dom.live.textContent = text; }, 60);
}

function nearBottom() {
  return document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) < 140;
}

function scrollToBottom({ force = false } = {}) {
  if (!force && !nearBottom()) return; // on ne vole jamais le scroll de l'utilisateur
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}

/* -------------------------------------------------------------------------- */
/* Persistance (localStorage uniquement : aucun endpoint serveur)             */
/* -------------------------------------------------------------------------- */

function loadStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && (item.role === 'user' || item.role === 'assistant')).slice(-MAX_STORED);
  } catch {
    return [];
  }
}

function saveStored() {
  try {
    const slim = state.messages.slice(-MAX_STORED).map((message) => ({
      role: message.role,
      text: message.text,
      sources: (message.sources ?? []).map((source) => ({
        id: source.id, document: source.document, category: source.category, score: source.score,
      })),
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch {
    /* quota ou mode privé : l'historique reste en mémoire pour la session */
  }
}

/* -------------------------------------------------------------------------- */
/* Pastille d'état — GET /api/health                                          */
/* -------------------------------------------------------------------------- */

const HEALTH_STATES = {
  ok: 'Service prêt',
  degraded: 'Index incomplet',
  error: 'Service indisponible',
  loading: 'Vérification…',
};

function setHealth(stateName, label) {
  dom.status.dataset.state = stateName;
  dom.statusLabel.textContent = label ?? HEALTH_STATES[stateName] ?? '';
  dom.status.setAttribute('aria-label', `État du service : ${label ?? HEALTH_STATES[stateName]}`);
}

async function refreshHealth() {
  setHealth('loading');
  try {
    const health = await getHealth();
    if (health.status === 'ok') setHealth('ok', 'Service prêt');
    else setHealth('degraded', health.llm_configured === false ? 'Clé modèle absente' : 'Index incomplet');
  } catch {
    setHealth('error', 'Service injoignable');
  }
}

/* -------------------------------------------------------------------------- */
/* Composeur                                                                  */
/* -------------------------------------------------------------------------- */

function autosize() {
  dom.input.style.height = 'auto';
  dom.input.style.height = `${Math.min(dom.input.scrollHeight, 200)}px`;
  syncComposerSpace();
}

function syncComposerSpace() {
  const height = dom.composerWrap.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--composer-space', `${Math.round(height)}px`);
}

function updateCount() {
  const length = dom.input.value.length;
  if (length >= COUNT_THRESHOLD) {
    dom.count.hidden = false;
    dom.count.textContent = `${length} / ${MAX_LENGTH}`;
    dom.count.dataset.over = String(length >= MAX_LENGTH);
  } else {
    dom.count.hidden = true;
    dom.count.textContent = '';
    delete dom.count.dataset.over;
  }
}

function setBusy(busy) {
  state.busy = busy;
  dom.send.disabled = busy;
  dom.stop.hidden = !busy;
  dom.thread.setAttribute('aria-busy', String(busy));
}

/* -------------------------------------------------------------------------- */
/* Feuille : lecture d'une source                                             */
/* -------------------------------------------------------------------------- */

const sheet = new Sheet({
  root: dom.sheet,
  scrim: dom.scrim,
  body: dom.sheetBody,
  title: dom.sheetTitle,
  kicker: dom.sheetKicker,
  closeButton: dom.sheetClose,
  dragHandles: [dom.grabber, $('.sheet__head')],
});

async function openSourceSheet(source, trigger) {
  sheet.open({
    kicker: source.document ?? 'Source',
    title: 'Lecture de l’extrait',
    trigger,
    content: el('div', {},
      el('p', { class: 'empty', text: 'Chargement de l’extrait…' }),
      el('p', { class: 'skeleton skeleton--mid' }),
      el('p', { class: 'skeleton' }),
    ),
  });

  try {
    const full = await getSource(source.id);
    const meta = el('ul', { class: 'sheet__meta' },
      el('li', { class: 'chip' }, icon('i-doc', 'icon icon--sm'), full.category || 'Document'),
      el('li', { class: 'chip', text: `Extrait ${full.chunk_id}` }),
      typeof full.score === 'number' ? el('li', { class: 'chip', text: `Pertinence ${Math.round(full.score * 100)} %` }) : null,
    );
    dom.sheetKicker.textContent = full.document;
    dom.sheetBody.replaceChildren(meta, el('p', { text: full.excerpt }));
  } catch (error) {
    const failure = describeFailure(error);
    dom.sheetBody.replaceChildren(buildError({
      title: failure.title,
      detail: failure.detail,
      onRetry: () => openSourceSheet(source, trigger),
    }));
  }
}

/* -------------------------------------------------------------------------- */
/* Feuille : historique                                                       */
/* -------------------------------------------------------------------------- */

function openHistorySheet(trigger) {
  const questions = state.messages.filter((message) => message.role === 'user');

  let content;
  if (!questions.length) {
    content = el('p', { class: 'empty', text: 'Vos questions apparaîtront ici. L’historique est conservé dans ce navigateur uniquement.' });
  } else {
    const list = el('ul', { class: 'history-list' });
    questions.forEach((question) => {
      const item = el('button', {
        class: 'history-item',
        type: 'button',
        'aria-current': question.index === state.activeIndex ? 'true' : 'false',
      }, icon('i-history', 'icon icon--sm'), el('span', { text: question.text }));

      item.addEventListener('click', () => {
        const target = dom.thread.querySelector(`.msg[data-index="${question.index}"]`);
        sheet.close();
        state.activeIndex = question.index;
        if (target) {
          target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      });
      list.append(el('li', {}, item));
    });

    const clear = el('button', { class: 'btn btn--glass', type: 'button' },
      el('span', { text: 'Effacer l’historique' }));
    clear.addEventListener('click', () => {
      state.messages = [];
      state.activeIndex = null;
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      dom.thread.replaceChildren();
      showWelcome();
      sheet.close();
      announce('Historique effacé.');
    });

    content = el('div', {}, list, el('div', { style: 'margin-top:var(--space-6)' }, clear));
  }

  sheet.open({ kicker: 'Session', title: 'Historique des questions', content, trigger });
}

/* -------------------------------------------------------------------------- */
/* Conversation                                                               */
/* -------------------------------------------------------------------------- */

function showWelcome() {
  dom.welcome.hidden = false;
  dom.thread.replaceChildren();
}

function hideWelcome() {
  dom.welcome.hidden = true;
}

function nextIndex() {
  return state.messages.filter((message) => message.role === 'user').length;
}

function appendMessage(message, { animate = true } = {}) {
  const node = buildMessage(message);
  if (!animate) node.style.animation = 'none';
  dom.thread.append(node);
  return node;
}

async function ask(rawQuestion, { fromHistory = false } = {}) {
  const question = String(rawQuestion ?? '').trim();
  if (!question || state.busy) return;

  hideWelcome();
  state.activeIndex = state.messages.length;

  const userMessage = { role: 'user', text: question, index: state.messages.length };
  state.messages.push(userMessage);
  appendMessage(userMessage);
  scrollToBottom({ force: true });

  dom.input.value = '';
  autosize();
  updateCount();

  await runAnswer(question, { fromHistory });
}

async function runAnswer(question, { retry = false } = {}) {
  setBusy(true);
  state.controller = new AbortController();

  const assistantMessage = { role: 'assistant', text: '', sources: [], index: state.messages.length };
  const node = appendMessage(assistantMessage);
  const body = node.querySelector('.msg__body');
  const typing = buildTyping();
  const skeleton = buildSkeletons(2);
  node.insertBefore(typing, body);
  node.append(skeleton);
  scrollToBottom({ force: true });

  let text = '';
  let sources = [];
  let frame = 0;
  let dirty = false;
  let failed = false;

  const paint = () => {
    frame = 0;
    if (!dirty) return;
    dirty = false;
    body.innerHTML = renderMarkdown(text);
  };

  const schedulePaint = () => {
    dirty = true;
    if (!frame) frame = window.requestAnimationFrame(paint);
  };

  const finishWithError = (failure, { canRetry = true } = {}) => {
    failed = true;
    typing.remove();
    skeleton.remove();
    if (frame) window.cancelAnimationFrame(frame);
    body.replaceChildren(buildError({
      title: failure.title,
      detail: failure.detail,
      onRetry: canRetry ? () => {
        node.remove();
        runAnswer(question, { retry: true });
      } : null,
    }));
    announce(`${failure.title}.`);
  };

  try {
    await streamChat(question, {
      signal: state.controller.signal,
      onSources: (incoming) => {
        sources = incoming;
        skeleton.remove();
        typing.querySelector('.typing__label').textContent = 'Rédaction de la réponse…';
        const existing = node.querySelector('[data-role="proof"]');
        existing?.remove();
        node.append(buildProof(sources, openSourceSheet));
      },
      onToken: (chunk) => {
        if (text === '') typing.remove();
        text += chunk;
        schedulePaint();
        if (nearBottom()) scrollToBottom();
      },
      onDone: () => { /* traité après la boucle */ },
      onError: (error) => {
        finishWithError({ title: 'La réponse a été interrompue', detail: error.message });
        state.controller?.abort();
      },
    });

    if (failed) return;

    if (frame) window.cancelAnimationFrame(frame);
    paint();
    typing.remove();
    skeleton.remove();

    if (!text.trim()) {
      body.replaceChildren(el('p', { class: 'empty', text: 'Le service n’a renvoyé aucun texte. Reformulez la question ou réessayez.' }));
    }

    assistantMessage.text = text;
    assistantMessage.sources = sources;
    state.messages.push(assistantMessage);

    node.append(buildMessageTools(text, announce));

    saveStored();
    // La réponse devient une région polie : le lecteur d'écran l'annonce une
    // fois, pas token par token (feedback.md › Make sure all feedback is accessible).
    body.setAttribute('aria-live', 'polite');
    announce(sources.length
      ? `Réponse terminée. ${sources.length} source${sources.length > 1 ? 's' : ''} consultée${sources.length > 1 ? 's' : ''}.`
      : 'Réponse terminée.');
  } catch (error) {
    if (error?.name === 'AbortError') {
      typing.remove();
      skeleton.remove();
      if (frame) window.cancelAnimationFrame(frame);
      paint();
      assistantMessage.text = text;
      assistantMessage.sources = sources;
      if (text) {
        state.messages.push(assistantMessage);
        node.append(buildMessageTools(text, announce));
        announce('Génération arrêtée. La réponse partielle est conservée.');
      } else {
        node.remove();
        announce('Génération arrêtée.');
      }
    } else {
      finishWithError(describeFailure(error));
    }
  } finally {
    state.controller = null;
    setBusy(false);
    dom.input.focus({ preventScroll: true });
  }
}

/* -------------------------------------------------------------------------- */
/* Nouvelle conversation                                                      */
/* -------------------------------------------------------------------------- */

function newConversation() {
  state.controller?.abort();
  state.messages = [];
  state.activeIndex = null;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  dom.thread.replaceChildren();
  showWelcome();
  dom.input.value = '';
  autosize();
  updateCount();
  dom.input.focus({ preventScroll: true });
  announce('Nouvelle conversation.');
}

/* -------------------------------------------------------------------------- */
/* Restauration de l'historique local                                         */
/* -------------------------------------------------------------------------- */

function restoreStored() {
  const stored = loadStored();
  if (!stored.length) return;

  hideWelcome();
  stored.forEach((item) => {
    state.messages.push({ ...item, index: state.messages.length });
    appendMessage({ ...item }, { animate: false });
  });

  // Les sources restaurées sont des métadonnées : la feuille recharge l'extrait.
  state.messages.forEach((message) => {
    if (message.role !== 'assistant' || !message.sources?.length) return;
    const node = dom.thread.querySelector(`.msg[data-index="${message.index}"]`);
    if (node) {
      node.append(buildProof(message.sources, openSourceSheet));
      node.append(buildMessageTools(message.text, announce));
    }
  });
  state.activeIndex = Math.max(0, state.messages.length - 2);
}

/* -------------------------------------------------------------------------- */
/* Écouteurs                                                                  */
/* -------------------------------------------------------------------------- */

dom.composer.addEventListener('submit', (event) => {
  event.preventDefault();
  ask(dom.input.value);
});

dom.input.addEventListener('input', () => {
  autosize();
  updateCount();
});

dom.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    dom.composer.requestSubmit();
  }
});

dom.stop.addEventListener('click', () => state.controller?.abort());

dom.newChat.addEventListener('click', newConversation);

dom.openHistory.addEventListener('click', (event) => openHistorySheet(event.currentTarget));

$$('[data-question]').forEach((button) => {
  button.addEventListener('click', () => ask(button.dataset.question));
});

window.addEventListener('resize', syncComposerSpace);
if ('ResizeObserver' in window) new ResizeObserver(syncComposerSpace).observe(dom.composerWrap);

// L'état du service est rafraîchi au retour sur l'onglet : une pastille figée
// mentirait après un redémarrage du serveur (feedback.md).
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshHealth();
});

/* -------------------------------------------------------------------------- */
/* Démonstration                                                              */
/* -------------------------------------------------------------------------- */
/* Outil de revue uniquement : `?demo=…&theme=…` rend un état stable sans
   backend, pour docs/design/validation-guide.html. Aucun effet sans le
   paramètre ; aucun appel réseau n'est simulé ici. */

const DEMO = {
  question: 'Comment demander un congé ?',
  partial: 'Le congé se demande via le formulaire interne, **cinq jours ouvrés** avant le départ.',
  answer: 'Le congé se demande via le formulaire interne, **cinq jours ouvrés** avant le départ.\n\n- Le formulaire est visé par le responsable d’équipe.\n- La réponse arrive sous deux jours ouvrés.\n- Le solde restant s’affiche dans l’espace RH.',
  sources: [
    { id: 'reglement-interieur.pdf::12', document: 'reglement-interieur.pdf', category: 'RH', score: 0.87 },
    { id: 'charte-teletravail.pdf::3', document: 'charte-teletravail.pdf', category: 'RH', score: 0.64 },
  ],
  excerpt: 'Article 12 — Les demandes de congé sont déposées cinq jours ouvrés avant le départ. '
    + 'Le responsable d’équipe dispose de deux jours ouvrés pour viser la demande.',
};

function renderDemo(kind) {
  if (!kind || kind === 'welcome') return;

  hideWelcome();
  const userMessage = { role: 'user', text: DEMO.question, index: 0 };
  state.messages.push(userMessage);
  appendMessage(userMessage, { animate: false });

  if (kind === 'error') {
    const node = appendMessage({ role: 'assistant', text: '', index: 1 }, { animate: false });
    node.querySelector('.msg__body').replaceChildren(buildError({
      title: 'Le service n’est pas encore configuré',
      detail: 'L’index documentaire ou la clé du modèle de réponse est absent côté serveur. '
        + 'Un administrateur doit indexer les documents, puis l’application répondra.',
      onRetry: () => {},
    }));
    return;
  }

  const text = kind === 'streaming' ? DEMO.partial : DEMO.answer;
  const assistant = appendMessage({ role: 'assistant', text, index: 1 }, { animate: false });
  assistant.append(buildProof(DEMO.sources, () => {}));

  if (kind === 'streaming') {
    const body = assistant.querySelector('.msg__body');
    assistant.insertBefore(buildTyping('Rédaction de la réponse…'), body);
  } else {
    assistant.append(buildMessageTools(text, announce));
  }

  if (kind === 'sheet') {
    const meta = el('ul', { class: 'sheet__meta' },
      el('li', { class: 'chip' }, icon('i-doc', 'icon icon--sm'), 'RH'),
      el('li', { class: 'chip', text: 'Extrait 12' }),
      el('li', { class: 'chip', text: 'Pertinence 87 %' }),
    );
    sheet.open({
      kicker: 'reglement-interieur.pdf',
      title: 'Lecture de l’extrait',
      content: el('div', {}, meta, el('p', { text: DEMO.excerpt })),
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Démarrage                                                                  */
/* -------------------------------------------------------------------------- */

const params = new URLSearchParams(window.location.search);
const forcedTheme = params.get('theme');
if (forcedTheme === 'light' || forcedTheme === 'dark') {
  document.documentElement.dataset.theme = forcedTheme;
}

if (params.get('demo')) renderDemo(params.get('demo'));
else restoreStored();

autosize();
updateCount();
refreshHealth();
window.setInterval(refreshHealth, 60000);

/* Constructions DOM et comportements d'interface.
 * Aucune donnée du modèle ou des documents n'est insérée sans échappement.
 */

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

const ICON_BASE = '/static/icons.svg';

export function icon(name, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `${ICON_BASE}#${name}`);
  svg.append(use);
  return svg;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

/* -------------------------------------------------------------------------- */
/* Markdown minimal et sûr                                                    */
/* -------------------------------------------------------------------------- */

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * Rend un sous-ensemble volontairement limité : paragraphes, listes à puces et
 * numérotées, gras, code inline. Tout est échappé AVANT transformation, donc
 * aucun HTML du modèle ne peut s'exécuter.
 */
export function renderMarkdown(text) {
  const blocks = String(text ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  const html = blocks.map((rawBlock) => {
    const block = rawBlock.trim();
    if (!block) return '';

    const lines = block.split('\n');
    if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
      const items = lines.map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
      const items = lines.map((line) => `<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('');
      return `<ol>${items}</ol>`;
    }
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  });
  return html.join('');
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

const AUTHOR = { user: 'Vous', assistant: 'Assistant' };

export function buildMessage({ role, text = '', index = 0, showAuthor = true }) {
  const node = el('article', { class: `msg msg--${role}`, dataset: { index: String(index), role } });

  if (showAuthor) {
    node.append(el('p', { class: 'msg__author', text: AUTHOR[role] ?? 'Assistant' }));
  }

  if (role === 'user') {
    node.append(el('div', { class: 'msg__bubble', text }));
  } else {
    const body = el('div', { class: 'msg__body' });
    body.innerHTML = renderMarkdown(text);
    node.append(body);
  }
  return node;
}

export function buildTyping(label = 'Recherche dans les documents…') {
  const dots = el('span', { class: 'typing__dots', 'aria-hidden': 'true' },
    el('span'), el('span'), el('span'));
  return el('p', { class: 'typing', dataset: { role: 'typing' } },
    dots, el('span', { class: 'typing__label', text: label }));
}

/* -------------------------------------------------------------------------- */
/* Rail de preuve                                                             */
/* -------------------------------------------------------------------------- */

export function buildSkeletons(count = 2) {
  const proof = el('div', { class: 'proof', dataset: { role: 'proof' } },
    el('p', { class: 'proof__label' }, icon('i-doc', 'icon icon--sm'), 'Recherche des sources'),
    el('div', { class: 'proof__rail rail', 'aria-hidden': 'true' },
      Array.from({ length: count }, () => el('div', { class: 'doc doc--skeleton' },
        el('span', { class: 'skeleton skeleton--short' }),
        el('span', { class: 'skeleton skeleton--mid' }),
        el('span', { class: 'skeleton' }),
      )),
    ),
  );
  return proof;
}

function scoreLabel(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return '';
  return `${Math.round(score * 100)} %`;
}

/**
 * Rangée de cartes-documents. Chaque carte ouvre la feuille de lecture.
 * @param {Array} sources
 * @param {(source: object, trigger: HTMLElement) => void} onOpen
 */
export function buildProof(sources, onOpen) {
  const rail = el('div', { class: 'proof__rail rail', role: 'list' });

  sources.forEach((source, position) => {
    const score = typeof source.score === 'number' ? Math.round(source.score * 100) : null;
    const card = el('button', {
      class: 'doc',
      type: 'button',
      role: 'listitem',
      'aria-label': `Source ${position + 1} : ${source.document}${score === null ? '' : `, pertinence ${score} %`}. Ouvrir l’extrait.`,
    },
      el('span', { class: 'doc__top' },
        el('span', { text: source.category || 'Document' }),
        el('span', { text: `· ${position + 1}` }),
      ),
      el('span', { class: 'doc__name', text: source.document }),
      el('span', { class: 'doc__gauge' },
        el('span', { class: 'doc__track', 'aria-hidden': 'true' },
          el('span', { class: 'doc__fill', style: `--score:${score ?? 0}%` }),
        ),
        el('span', { class: 'doc__score', text: score === null ? '' : `${score} %` }),
      ),
    );

    card.addEventListener('click', () => onOpen(source, card));
    rail.append(card);
  });

  const count = sources.length;
  return el('div', { class: 'proof' },
    el('p', { class: 'proof__label' },
      icon('i-doc', 'icon icon--sm'),
      count === 1 ? '1 source consultée' : `${count} sources consultées`,
    ),
    rail,
  );
}

/* -------------------------------------------------------------------------- */
/* Outils de message                                                          */
/* -------------------------------------------------------------------------- */

export function buildMessageTools(text, onCopy) {
  const copy = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Copier la réponse' },
    icon('i-copy', 'icon icon--sm'));
  const tools = el('div', { class: 'msg__tools' }, copy);

  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      copy.replaceChildren(icon('i-check', 'icon icon--sm'));
      copy.setAttribute('aria-label', 'Réponse copiée');
      onCopy?.('Réponse copiée dans le presse-papiers.');
      window.setTimeout(() => {
        copy.replaceChildren(icon('i-copy', 'icon icon--sm'));
        copy.setAttribute('aria-label', 'Copier la réponse');
      }, 1800);
    } catch {
      onCopy?.('Copie impossible : le presse-papiers est indisponible.');
    }
  });

  return tools;
}

export function buildError({ title, detail, onRetry, retryLabel = 'Réessayer' }) {
  const actions = el('div', { class: 'error__actions' });
  if (onRetry) {
    actions.append(el('button', { class: 'btn btn--filled', type: 'button', onclick: onRetry },
      icon('i-refresh', 'icon icon--sm'), el('span', { text: retryLabel })));
  }
  return el('div', { class: 'error', role: 'alert' },
    el('p', { class: 'error__title' }, icon('i-alert', 'icon icon--sm'), title),
    detail ? el('p', { class: 'error__detail', text: detail }) : null,
    onRetry ? actions : null,
  );
}

/* -------------------------------------------------------------------------- */
/* Feuille latérale — glissement 1:1, bande de caoutchouc, projection d'élan  */
/* (motion-physics.md §3–§7 ; components.md › 4)                              */
/* -------------------------------------------------------------------------- */

const rubber = (overshoot, dimension, c = 0.55) => (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
const project = (velocity, deceleration = 0.998) => (velocity / 1000) * deceleration / (1 - deceleration);
const DISMISS_VELOCITY = 800; // px/s

export class Sheet {
  constructor({ root, scrim, body, title, kicker, closeButton, dragHandles, onClose }) {
    this.root = root;
    this.scrim = scrim;
    this.body = body;
    this.title = title;
    this.kicker = kicker;
    this.closeButton = closeButton;
    this.dragHandles = dragHandles;
    this.onClose = onClose;
    this.trigger = null;

    this.closeButton.addEventListener('click', () => this.close());
    this.scrim.addEventListener('click', () => this.close());
    document.addEventListener('keydown', (event) => {
      if (this.isOpen && event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
      if (this.isOpen && event.key === 'Tab') this.#trapFocus(event);
    });

    this.dragHandles.forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => this.#startDrag(event));
    });
  }

  get isOpen() {
    return this.root.dataset.open === 'true';
  }

  open({ kicker = '', title = '', content = null, trigger = null }) {
    this.trigger = trigger ?? document.activeElement;
    this.kicker.textContent = kicker;
    this.title.textContent = title;
    this.body.replaceChildren(...(content ? [content] : []));
    this.body.scrollTop = 0;

    this.root.hidden = false;
    this.scrim.hidden = false;
    this.root.style.transform = '';
    document.body.style.overflow = 'hidden';

    // Deux images : l'élément doit être peint avant de basculer l'état,
    // sinon la transition ne part pas (entrée « materialize »).
    requestAnimationFrame(() => {
      this.root.dataset.open = 'true';
      this.closeButton.focus({ preventScroll: true });
    });
  }

  close() {
    if (!this.isOpen) return;
    this.root.dataset.open = 'false';
    document.body.style.overflow = '';
    const finish = () => {
      this.root.hidden = true;
      this.scrim.hidden = true;
      this.onClose?.();
      this.trigger?.focus?.({ preventScroll: true });
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) finish();
    else window.setTimeout(finish, 300); // durée du ressort (--duration-base)
  }

  #trapFocus(event) {
    const focusables = this.root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  #startDrag(event) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (event.button !== undefined && event.button !== 0) return;

    const height = this.root.offsetHeight;
    const startY = event.clientY;
    const samples = [{ y: 0, t: event.timeStamp }];
    let currentY = 0;

    this.root.dataset.dragging = 'true';
    this.dragHandles.forEach((handle) => handle.setPointerCapture?.(event.pointerId));

    const onMove = (moveEvent) => {
      let dy = moveEvent.clientY - startY;
      if (dy < 0) dy = -rubber(-dy, height); // résistance au-delà du haut
      currentY = dy;
      this.root.style.transform = `translateY(${dy}px)`;
      samples.push({ y: dy, t: moveEvent.timeStamp });
      if (samples.length > 6) samples.shift();
    };

    const onUp = () => {
      this.root.dataset.dragging = 'false';
      this.root.style.transform = '';

      const first = samples[0];
      const last = samples[samples.length - 1];
      const elapsed = Math.max(1, last.t - first.t);
      const velocity = ((last.y - first.y) / elapsed) * 1000; // px/s
      const landing = currentY + project(velocity);

      const shouldClose = landing > height * 0.4 || velocity > DISMISS_VELOCITY;
      if (shouldClose) this.close();

      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }
}

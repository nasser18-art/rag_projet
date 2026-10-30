/* Vérification fonctionnelle du frontend sans navigateur.
 *
 * Charge le vrai frontend/index.html et exécute le vrai frontend/app.js dans
 * jsdom, avec un /api/chat simulé (SSE). Aucun fichier du dépôt n'est modifié.
 *
 * Lancement (jsdom n'est PAS une dépendance du projet, elle n'est utilisée que
 * pour cette vérification, hors application) :
 *
 *   mkdir -p /tmp/domtest && cd /tmp/domtest
 *   npm init -y && npm install jsdom@24
 *   NODE_PATH=/tmp/domtest/node_modules node /chemin/vers/rag_projet/docs/design/tools/frontend-check.js
 *
 * (NODE_PATH est nécessaire : jsdom est installé hors du dépôt, pour ne pas
 * ajouter de dépendance au projet.)
 *
 * Sortie : un OK/FAIL par contrôle, code de sortie 1 si un contrôle échoue.
 */
const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');
const { JSDOM } = require('jsdom');

const REPO = path.resolve(__dirname, '..', '..', '..');
const html = fs.readFileSync(path.join(REPO, 'frontend/index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(REPO, 'frontend/app.js'), 'utf8');
const css = fs.readFileSync(path.join(REPO, 'frontend/styles.css'), 'utf8');

let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  OK   ' + label); }
  else { failures.push(label); console.log('  FAIL ' + label + (detail ? ' -> ' + detail : '')); }
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function settle(n = 3) { for (let i = 0; i < n; i += 1) await tick(); }
/* Laisse passer une frame d'animation (rendu du flux) et les minuteurs d'annonce. */
const settleFrames = (n = 2) => new Promise((resolve) => setTimeout(resolve, 40 * n));

function chunk(text) { return Buffer.from(text, 'utf8'); }

function makeStream(signal) {
  let signalRef = signal;
  const queue = [];
  let pending = null;
  let closed = false;
  return {
    attachSignal(nextSignal) { signalRef = nextSignal; },
    push(data) {
      if (pending) { const resolve = pending; pending = null; resolve({ value: data, done: false }); }
      else queue.push(data);
    },
    close() {
      closed = true;
      if (pending) { const resolve = pending; pending = null; resolve({ value: undefined, done: true }); }
    },
    reader: {
      read() {
        if (queue.length) return Promise.resolve({ value: queue.shift(), done: false });
        if (closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve, reject) => {
          pending = resolve;
          if (signalRef) {
            signalRef.addEventListener('abort', () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            }, { once: true });
          }
        });
      },
      cancel() { closed = true; return Promise.resolve(); },
    },
  };
}

async function boot() {
  const dom = new JSDOM(html, {
    url: 'http://localhost:8000/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.TextDecoder = TextDecoder;
  window.TextEncoder = TextEncoder;
  window.matchMedia = (query) => ({
    media: query,
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.ResizeObserver = class { observe() {} disconnect() {} };
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: async (text) => { window.__copied = text; } },
    configurable: true,
  });
  window.eval(appJs);
  await settle(2);
  return { dom, window };
}

const $ = (window, selector) => window.document.querySelector(selector);
const $$ = (window, selector) => Array.from(window.document.querySelectorAll(selector));

async function testHappyPath() {
  console.log('\n[A] Question, sources reçues pendant le flux, réponse streamée');
  const { window } = await boot();
  const stream = makeStream();
  let requestBody = null;
  window.fetch = (url, options) => {
    requestBody = { url, body: JSON.parse(options.body) };
    stream.attachSignal(options.signal);
    return Promise.resolve({ ok: true, body: { getReader: () => stream.reader } });
  };

  const input = $(window, '#question');
  input.value = 'Comment demander un congé ?';
  $(window, '#composer').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();

  check('un message utilisateur apparaît', $$(window, '.message.user').length === 1);
  check('le message utilisateur contient la question',
    $(window, '.message.user .markdown').textContent.trim() === 'Comment demander un congé ?');
  check('un message assistant est créé', $$(window, '.message.assistant').length === 1);
  check("l'état d'attente est annoncé", !!(window.document.body.textContent.includes('Recherche dans les documents')),
    'libellé absent');
  check('le bouton d\'envoi est désactivé pendant le flux', $(window, '#send').disabled === true);
  check('le bouton Arrêter est visible pendant le flux', $(window, '#stop').hidden === false);
  check('la conversation porte aria-busy', $(window, '#chat').getAttribute('aria-busy') === 'true');
  check('la requête part vers /api/chat', requestBody && requestBody.url === '/api/chat');
  check('la requête demande le flux', requestBody && requestBody.body.stream === true);
  check('l\'historique liste la question', $$(window, '#history button').length === 1);
  check('la question courante est signalée', $(window, '#history button').getAttribute('aria-current') === 'true');

  stream.push(chunk('data: ' + JSON.stringify({
    type: 'sources',
    sources: [
      { id: 's1', document: 'RH/conges.pdf', category: 'RH', chunk_id: 12, excerpt: 'Tout salarié peut poser un congé.', score: 0.8213 },
      { id: 's2', document: 'RH/teletravail.docx', category: 'RH', chunk_id: 4, excerpt: 'Le télétravail est possible.', score: 0.412 },
    ],
  }) + '\n\n'));
  await settle();

  check('les sources apparaissent AVANT la fin du flux', $$(window, '.source').length === 2,
    $$(window, '.source').length + ' source(s)');
  check('les sources sont numérotées', $(window, '.source-index').textContent.trim() === '[1]');
  check('le nom du document est affiché', $(window, '.source-name').textContent.trim() === 'RH/conges.pdf');
  check('la catégorie et le score sont affichés',
    $(window, '.source-meta').textContent.includes('RH') && $(window, '.source-meta').textContent.includes('82 %'),
    $(window, '.source-meta') && $(window, '.source-meta').textContent);
  check('l\'extrait est masqué par défaut', $(window, '.source-excerpt').hidden === true);
  check('le bouton de source expose aria-expanded=false',
    $(window, '.source-toggle').getAttribute('aria-expanded') === 'false');
  check('le résumé annonce le nombre de sources',
    $(window, '.sources-panel > summary').textContent.includes('(2)'));

  $(window, '.source-toggle').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('le clic ouvre l\'extrait', $(window, '.source-excerpt').hidden === false);
  check('aria-expanded passe à true', $(window, '.source-toggle').getAttribute('aria-expanded') === 'true');

  stream.push(chunk('data: ' + JSON.stringify({ type: 'token', content: 'Vous pouvez **poser** un congé' }) + '\n\n'));
  await settleFrames(1);
  stream.push(chunk('data: ' + JSON.stringify({ type: 'token', content: ' via le formulaire.' }) + '\n\n'));
  await settleFrames(1);

  const body = $(window, '.message.assistant .markdown');
  check('le texte est rendu progressivement', body.textContent.includes('Vous pouvez poser un congé'));
  check('le gras Markdown est interprété', body.innerHTML.includes('<strong>poser</strong>'));
  check('le marqueur de chargement reste pendant le flux', body.classList.contains('loading'));

  stream.push(chunk('data: {"type":"done"}\n\n'));
  stream.close();
  await settleFrames(2);

  check('le marqueur de chargement est retiré à la fin', !$ (window, '.message.assistant .markdown').classList.contains('loading'));
  check('le bouton d\'envoi est réactivé', $(window, '#send').disabled === false);
  check('le bouton Arrêter est masqué', $(window, '#stop').hidden === true);
  check('aria-busy retombe à false', $(window, '#chat').getAttribute('aria-busy') === 'false');
  check('l\'état d\'attente a disparu', $$(window, '.message-status').length === 0);
  check('le focus revient au champ', window.document.activeElement === $(window, '#question'));
  check('la fin est annoncée une fois', $(window, '#live-status').textContent.includes('Réponse terminée'),
    $(window, '#live-status').textContent);
  check('la réponse est copiable', $(window, '.message.assistant .copy').disabled === false);

  $(window, '.message.assistant .copy').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await settle();
  check('la copie fonctionne', typeof window.__copied === 'string' && window.__copied.includes('congé'));
  check('le bouton Copier confirme', $(window, '.message.assistant .copy').textContent === 'Copié');
}

async function testErrorAndRetry() {
  console.log('\n[B] Erreur serveur puis « Réessayer »');
  const { window } = await boot();
  let attempts = 0;
  window.fetch = () => {
    attempts += 1;
    if (attempts === 1) {
      return Promise.resolve({ ok: false, json: async () => ({ detail: 'Le service documentaire n\'est pas encore configuré.' }) });
    }
    const stream = makeStream();
    setTimeout(() => {
      stream.push(chunk('data: {"type":"token","content":"Deuxième tentative."}\n\n'));
      stream.push(chunk('data: {"type":"done"}\n\n'));
      stream.close();
    }, 0);
    return Promise.resolve({ ok: true, body: { getReader: () => stream.reader } });
  };

  const input = $(window, '#question');
  input.value = 'Question qui échoue';
  $(window, '#composer').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await settle(4);

  const block = $(window, '.error-block');
  check('un bloc d\'erreur structuré apparaît', !!block);
  check('le bloc d\'erreur est annoncé (role=alert)', block && block.getAttribute('role') === 'alert');
  check('le message du serveur est repris', block && block.textContent.includes('n\'est pas encore configuré'));
  check('une action de correction est proposée', !!$(window, '.retry-button'));
  check('le focus va sur « Réessayer »', window.document.activeElement === $(window, '.retry-button'));
  check('le bouton d\'envoi est réactivé', $(window, '#send').disabled === false);

  $(window, '.retry-button').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await settle(4);
  check('« Réessayer » relance une requête', attempts === 2);
  check('la réponse de la seconde tentative s\'affiche',
    $(window, '.message.assistant .markdown').textContent.includes('Deuxième tentative'),
    $(window, '.message.assistant .markdown').textContent);
}

async function testAbort() {
  console.log('\n[C] Arrêt de la génération');
  const { window } = await boot();
  let stream;
  window.fetch = (url, options) => {
    stream = makeStream(options.signal);
    return Promise.resolve({ ok: true, body: { getReader: () => stream.reader } });
  };

  $(window, '#question').value = 'Question longue';
  $(window, '#composer').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  stream.push(chunk('data: {"type":"token","content":"Début de"}\n\n'));
  await settle();

  $(window, '#stop').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await settleFrames(2);

  const text = $(window, '.message.assistant .markdown').textContent;
  check('le texte partiel est conservé', text.includes('Début de'), text);
  check('l\'arrêt est annoncé', $(window, '#live-status').textContent.includes('arrêtée'),
    $(window, '#live-status').textContent);
  check('le bouton d\'envoi redevient actif', $(window, '#send').disabled === false);
}

async function testTheme() {
  console.log('\n[D] Apparence : système par défaut, choix explicite');
  const { window } = await boot();
  const root = window.document.documentElement;
  const toggle = $(window, '#theme-toggle');

  check('le mode par défaut est « système »', root.getAttribute('data-theme-mode') === 'system');
  check('le libellé annonce le mode courant', toggle.textContent.includes('système'));
  check('le libellé décrit l\'action suivante', toggle.getAttribute('aria-label').includes('Passer à clair'),
    toggle.getAttribute('aria-label'));

  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('1er clic → clair', root.getAttribute('data-theme-mode') === 'light' && root.getAttribute('data-theme') === 'light');

  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('2e clic → sombre', root.getAttribute('data-theme-mode') === 'dark' && root.getAttribute('data-theme') === 'dark');
  check('le choix est mémorisé', window.localStorage.getItem('theme') === 'dark');

  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('3e clic → retour à système', root.getAttribute('data-theme-mode') === 'system');

  const mobile = $(window, '#mobile-theme');
  check('le bouton mobile est synchronisé', mobile.getAttribute('aria-label').includes('Apparence'));
}

async function testDrawer() {
  console.log('\n[E] Tiroir d\'historique sur petite largeur');
  const { window } = await boot();
  const toggle = $(window, '#mobile-history');
  const scrim = $(window, '#sidebar-scrim');

  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('le tiroir s\'ouvre', window.document.body.getAttribute('data-drawer') === 'open');
  check('aria-expanded passe à true', toggle.getAttribute('aria-expanded') === 'true');
  check('le voile de fermeture est visible', scrim.hidden === false);
  check('le focus entre dans le panneau',
    $(window, '#sidebar').contains(window.document.activeElement),
    window.document.activeElement && window.document.activeElement.id);

  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Échap referme le tiroir', window.document.body.getAttribute('data-drawer') !== 'open');
  check('aria-expanded repasse à false', toggle.getAttribute('aria-expanded') === 'false');
  check('le focus revient au bouton', window.document.activeElement === toggle);
  check('le voile est caché', scrim.hidden === true);
}

async function testEmptyStates() {
  console.log('\n[F] États vides et nouvelle conversation');
  const { window } = await boot();

  check('l\'historique vide explique quoi faire', !!$(window, '.history-empty'));
  check('le message d\'historique vide est explicite',
    $(window, '.history-empty').textContent.includes('Vos questions apparaîtront ici'));

  const stream = makeStream();
  window.fetch = () => Promise.resolve({ ok: true, body: { getReader: () => stream.reader } });
  $(window, '#question').value = 'Première question';
  $(window, '#composer').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  stream.push(chunk('data: {"type":"token","content":"ok"}\n\n'));
  stream.close();
  await settle();

  check('l\'accueil a disparu après la première question', !$(window, '#welcome'));

  $(window, '#new-chat').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await settle();
  check('« Nouvelle conversation » vide la conversation', $$(window, '.message').length === 0);
  check('l\'accueil revient', !!$(window, '#welcome'));
  check('les questions d\'exemple reviennent',
    $$(window, '#welcome [data-question]').length === 4,
    $$(window, '#welcome [data-question]').length + ' bouton(s)');
  check('l\'historique est de nouveau vide', !!$(window, '.history-empty'));

  const example = $(window, '#welcome [data-question]');
  example.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await settle();
  check('une question d\'exemple relancée fonctionne', $$(window, '.message.user').length === 1,
    'le clone de l\'accueil doit être recâblé');
}

async function testComposer() {
  console.log('\n[G] Composeur : compteur, Maj+Entrée, limite');
  const { window } = await boot();
  const input = $(window, '#question');
  const sendCount = () => window.__sent || 0;
  window.__sent = 0;
  window.fetch = () => { window.__sent += 1; const s = makeStream(); s.close(); return Promise.resolve({ ok: true, body: { getReader: () => s.reader } }); };

  check('le texte d\'aide est lié au champ',
    input.getAttribute('aria-describedby') === 'composer-hint' && !!$(window, '#composer-hint'));
  check('un libellé visible est associé au champ',
    $(window, 'label[for="question"]') && $(window, 'label[for="question"]').textContent.includes('Votre question'));

  input.value = 'a'.repeat(3600);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  check('le compteur apparaît au-delà du seuil', $(window, '#char-count').hidden === false);
  check('le compteur affiche la longueur', $(window, '#char-count').textContent.includes('3600'));

  input.value = 'court';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  check('le compteur disparaît sous le seuil', $(window, '#char-count').hidden === true);

  input.value = 'Entrée';
  const enter = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  input.dispatchEvent(enter);
  await settle();
  check('Entrée envoie la question', sendCount() === 1, 'envois: ' + sendCount());

  input.value = 'Suite';
  const shiftEnter = new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
  input.dispatchEvent(shiftEnter);
  await settle();
  check('Maj+Entrée n\'envoie pas', sendCount() === 1, 'envois: ' + sendCount());
}

async function testCSSSanity() {
  console.log('\n[H] Feuille de style : préférences système et états');
  check('prefers-reduced-motion est traité', css.includes('prefers-reduced-motion: reduce'));
  check('prefers-reduced-transparency est traité', css.includes('prefers-reduced-transparency: reduce'));
  check('prefers-contrast est traité', css.includes('prefers-contrast: more'));
  check('prefers-color-scheme est traité', css.includes('prefers-color-scheme: dark'));
  check('un anneau de focus visible est défini', css.includes(':focus-visible'));
  check('aucune animation infinie plein écran (blink supprimé)', !css.includes('@keyframes blink'));
  check('le verre a un repli opaque', /prefers-reduced-transparency[\s\S]{0,200}backdrop-filter: none/.test(css));
  check('les halos décoratifs du composeur sont supprimés', !css.includes('composer::before') && !css.includes('composer::after'));
}

(async () => {
  await testHappyPath();
  await testErrorAndRetry();
  await testAbort();
  await testTheme();
  await testDrawer();
  await testEmptyStates();
  await testComposer();
  await testCSSSanity();

  console.log('\n=========================================');
  console.log(`Contrôles réussis : ${passed}`);
  console.log(`Échecs : ${failures.length}`);
  if (failures.length) {
    failures.forEach((label) => console.log('  - ' + label));
    process.exit(1);
  }
})();

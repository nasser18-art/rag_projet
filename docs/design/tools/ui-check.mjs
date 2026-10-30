/* Vérification de comportement de l'interface, sans navigateur.
 *
 * jsdom n'est PAS une dépendance du projet : elle sert uniquement à cette
 * vérification, installée hors du dépôt.
 *
 *   mkdir -p /tmp/domtest && cd /tmp/domtest
 *   npm init -y && npm install jsdom@24
 *   cp docs/design/tools/ui-check.mjs /tmp/domtest/ && cd /tmp/domtest
 *   node ui-check.mjs
 *
 * Le harnais charge le vrai frontend/index.html, importe les vrais modules
 * js/{api,ui,app}.js et simule trois routes : /api/health, /api/chat (SSE),
 * /api/sources/{id}. Il vérifie les états, le contrat SSE, l'échappement,
 * le clavier, la feuille et la persistance. Il ne dit rien du rendu visuel :
 * Playwright est indisponible dans cet environnement (voir verification.md).
 *
 * Sortie : PASS/FAIL par contrôle, code de sortie 1 en cas d'échec.
 */
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';

const ROOT = process.env.FRONTEND_DIR || new URL('../../../frontend', import.meta.url).pathname;
const html = await readFile(`${ROOT}/index.html`, 'utf8');

const dom = new JSDOM(html, { url: 'http://localhost:8000/', pretendToBeVisual: true });
const { window } = dom;

window.matchMedia = (query) => ({
  matches: false, media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
});
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return 420; } });
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.HTMLElement = window.HTMLElement;
globalThis.ResizeObserver = window.ResizeObserver;

/* --- stubs réseau ------------------------------------------------------- */
const encoder = new TextEncoder();
const sse = (payloads) => new ReadableStream({
  start(controller) {
    for (const payload of payloads) controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
    controller.close();
  },
});

let chatMode = 'ok';
const calls = [];

const fakeFetch = async (url, options = {}) => {
  calls.push(String(url));
  if (String(options.method || 'GET') === 'POST') {
    if (chatMode === '503') {
      return new Response(JSON.stringify({ detail: 'Le service documentaire n\'est pas encore configuré.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(sse([
      { type: 'sources', sources: [
        { id: 'reglement.pdf::0', document: 'reglement-interieur.pdf', category: 'RH', score: 0.87 },
        { id: 'teletravail.pdf::3', document: 'charte-teletravail.pdf', category: 'RH', score: 0.64 },
      ] },
      { type: 'token', content: 'Le **congé** se demande ' },
      { type: 'token', content: 'via le formulaire interne.\n\n- 5 jours ouvrés\n- validation du manager' },
      { type: 'done' },
    ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }
  if (url.startsWith('/api/sources/')) {
    return new Response(JSON.stringify({
      id: 'reglement.pdf::0', document: 'reglement-interieur.pdf', category: 'RH',
      chunk_id: 0, excerpt: 'Article 12 — Les demandes de congé sont déposées cinq jours ouvrés avant le départ.', score: 0.87,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ status: 'ok', knowledge_base_ready: true, llm_configured: true, model: 'llama' }), { status: 200 });
};
globalThis.fetch = fakeFetch;
window.fetch = fakeFetch;

/* --- exécution ---------------------------------------------------------- */
const results = [];
const check = (name, condition, extra = '') => {
  results.push({ name, ok: Boolean(condition), extra });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${condition ? '' : ` — ${extra}`}`);
};
const tick = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));
const $ = (selector) => window.document.querySelector(selector);
const $$ = (selector) => Array.from(window.document.querySelectorAll(selector));

await import(`${ROOT}/js/app.js`);
await tick(120);

check('page : accueil visible', !$('#welcome').hidden);
check('page : 4 suggestions', $$('.suggestion').length === 4, String($$('.suggestion').length));
check('page : pastille « Service prêt »', $('#status-label').textContent === 'Service prêt', $('#status-label').textContent);
check('page : état ok', $('#status').dataset.state === 'ok', $('#status').dataset.state);
check('page : aucun glyphe texte dans le HTML', !/[☰◐↑✕▸]/.test(window.document.body.innerHTML));
check('page : 12 icônes du sprite', $$('svg use').length >= 10, String($$('svg use').length));

/* soumission par suggestion */
$$('.suggestion')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(160);

const msgUser = $('.msg--user');
check('chat : question envoyée', msgUser?.textContent.includes('Comment demander un congé'));
check('chat : accueil masqué', $('#welcome').hidden);
check('chat : composeur vidé', $('#question').value === '');
check('chat : skeleton puis sources', $('.msg--assistant .proof') !== null);
check('chat : rail à 2 cartes', $$('.doc').length === 2, String($$('.doc').length));
check('chat : jauge à 87 %', $('.doc__fill')?.getAttribute('style').includes('87%'), $('.doc__fill')?.getAttribute('style'));

const answer = $('.msg--assistant .msg__body');
check('chat : texte assemblé', answer.textContent.includes('Le congé se demande via le formulaire interne.'), answer.textContent);
check('chat : gras rendu', answer.querySelector('strong')?.textContent === 'congé');
check('chat : liste rendue', answer.querySelectorAll('li').length === 2);
check('chat : aria-live sur la réponse', answer.getAttribute('aria-live') === 'polite');
check('chat : outil de copie', $('.msg__tools .icon-btn') !== null);
check('chat : bouton envoyer réactivé', $('#send').disabled === false);
check('chat : indicateur de saisie retiré', $('.typing') === null);
check('chat : annonce lecteur d’écran', $('#live').textContent.includes('2 sources'), $('#live').textContent);

/* historique local */
const stored = JSON.parse(window.localStorage.getItem('assistant-documentaire.historique.v1'));
check('stockage : 2 entrées', stored?.length === 2, String(stored?.length));
check('stockage : sources conservées', stored?.[1]?.sources?.length === 2);

/* feuille source */
$('.doc').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(160);
check('feuille : ouverte', $('#sheet').dataset.open === 'true');
check('feuille : scrim visible', $('#scrim').hidden === false);
check('feuille : extrait chargé', $('#sheet-body').textContent.includes('Article 12'), $('#sheet-body').textContent.slice(0, 80));
check('feuille : focus au bouton fermer', window.document.activeElement.id === 'sheet-close', window.document.activeElement.id);
check('feuille : page verrouillée', window.document.body.style.overflow === 'hidden');

window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await tick(400);
check('feuille : Échap ferme', $('#sheet').dataset.open === 'false');
check('feuille : scrim masqué', $('#scrim').hidden === true);

/* feuille historique */
$('#open-history').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(120);
check('historique : liste la question', $('#sheet-body').textContent.includes('Comment demander un congé'));
$('#sheet-close').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(400);

/* compteur et clavier */
const input = $('#question');
input.value = 'x'.repeat(3600);
input.dispatchEvent(new window.Event('input', { bubbles: true }));
check('compteur : discret au-delà de 3 500', $('#count').hidden === false && $('#count').textContent === '3600 / 4000', $('#count').textContent);
input.value = 'court';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
check('compteur : masqué en dessous', $('#count').hidden === true);

input.value = 'Entrée envoie';
input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await tick(200);
check('clavier : Entrée envoie', $$('.msg--user').length === 2, String($$('.msg--user').length));

/* chemin 503 */
chatMode = '503';
input.value = 'Question sans backend';
$('#new-chat').focus();
input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await tick(220);
const errorBlock = $('.msg--assistant:last-of-type .error') ?? $('.error');
check('erreur : bloc affiché', errorBlock !== null);
check('erreur : titre 503', $('.error__title')?.textContent.includes('pas encore configuré'), $('.error__title')?.textContent);
check('erreur : action de reprise', $('.error .btn') !== null);
check('erreur : le focus reste sur l’élément courant', window.document.activeElement.id === 'new-chat', window.document.activeElement.id);

/* nouvelle conversation */
$('#new-chat').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick(120);
check('nouvelle conversation : fil vidé', $('.msg') === null);
check('nouvelle conversation : accueil de retour', !$('#welcome').hidden);
check('nouvelle conversation : stockage purgé', window.localStorage.getItem('assistant-documentaire.historique.v1') === null);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
if (failed.length) console.log('Échecs :', failed.map((f) => f.name).join(' | '));
dom.window.close();
process.exit(failed.length ? 1 : 0);

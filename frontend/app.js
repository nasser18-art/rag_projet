/* Assistant documentaire — logique d'interface (JavaScript vanilla, sans dépendance).
 *
 * Contrats conservés depuis la version précédente :
 *   - mêmes identifiants (#chat, #composer, #question, #send, #history,
 *     #message-template, #new-chat, #mobile-new-chat, #theme-toggle, #mobile-theme) ;
 *   - mêmes classes (app-shell, message, markdown, sources, source, sender,
 *     avatar, copy, loading, quiet-button…) ;
 *   - mêmes routes (/api/chat en SSE).
 *
 * Ajouts : apparence à trois états, tiroir d'historique mobile, arrêt de la
 * génération, état d'erreur avec « Réessayer », sources numérotées reçues dès
 * le premier événement, annonces lecteur d'écran uniques.
 */
(function () {
  'use strict';

  const chat = document.querySelector('#chat');
  const form = document.querySelector('#composer');
  const input = document.querySelector('#question');
  const send = document.querySelector('#send');
  const stop = document.querySelector('#stop');
  const historyNav = document.querySelector('#history');
  const template = document.querySelector('#message-template');
  const charCount = document.querySelector('#char-count');
  const liveStatus = document.querySelector('#live-status');
  const composerWrap = document.querySelector('.composer-wrap');
  const scrim = document.querySelector('#sidebar-scrim');
  const drawerToggle = document.querySelector('#mobile-history');
  const sidebarClose = document.querySelector('#sidebar-close');

  const MAX_LENGTH = Number(input.getAttribute('maxlength')) || 4000;
  const COUNT_THRESHOLD = Math.round(MAX_LENGTH * 0.875);
  const THEME_MODES = ['system', 'light', 'dark'];
  const THEME_LABELS = { system: 'système', light: 'clair', dark: 'sombre' };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let messages = [];
  let controller = null;
  const welcomeTemplate = document.querySelector('#welcome')
    ? document.querySelector('#welcome').cloneNode(true)
    : null;

  /* ---------------------------------------------------------------------- */
  /* Utilitaires                                                            */
  /* ---------------------------------------------------------------------- */

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  /* Rendu Markdown volontairement minimal : gras, code inline, sauts de ligne.
     Tout le contenu est échappé avant transformation. */
  function markdown(text) {
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function scrollBehavior() {
    return reduceMotion.matches ? 'auto' : 'smooth';
  }

  function isNearBottom() {
    const doc = document.documentElement;
    return doc.scrollHeight - (window.scrollY + window.innerHeight) < 120;
  }

  function scrollToBottom(force) {
    if (!force && !isNearBottom()) return;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: scrollBehavior() });
  }

  function announce(text) {
    if (!liveStatus) return;
    liveStatus.textContent = '';
    window.setTimeout(() => {
      liveStatus.textContent = text;
    }, 60);
  }

  /* ---------------------------------------------------------------------- */
  /* Apparence : système par défaut, choix explicite en surcharge           */
  /* ---------------------------------------------------------------------- */

  function currentMode() {
    const stored = document.documentElement.getAttribute('data-theme-mode');
    return THEME_MODES.includes(stored) ? stored : 'system';
  }

  function applyTheme(mode, persist) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = mode === 'dark' || (mode === 'system' && prefersDark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-mode', mode);
    if (persist) {
      try {
        localStorage.setItem('theme', mode);
      } catch (error) {
        /* stockage indisponible : le choix ne survivra pas au rechargement */
      }
    }
    updateThemeControls(mode);
  }

  function updateThemeControls(mode) {
    const next = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
    const name = THEME_LABELS[mode];
    const nextName = THEME_LABELS[next];
    document.querySelectorAll('.theme-label, #theme-toggle .theme-label').forEach((node) => {
      node.textContent = 'Thème : ' + name;
    });
    ['#theme-toggle', '#mobile-theme'].forEach((selector) => {
      const button = document.querySelector(selector);
      if (button) button.setAttribute('aria-label', 'Apparence : ' + name + '. Passer à ' + nextName + '.');
    });
  }

  function cycleTheme() {
    const next = THEME_MODES[(THEME_MODES.indexOf(currentMode()) + 1) % THEME_MODES.length];
    applyTheme(next, true);
    announce('Apparence : ' + THEME_LABELS[next]);
  }

  document.querySelector('#theme-toggle')?.addEventListener('click', cycleTheme);
  document.querySelector('#mobile-theme')?.addEventListener('click', cycleTheme);
  applyTheme(currentMode(), false);

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemAppearanceChange = () => {
    if (currentMode() === 'system') applyTheme('system', false);
  };
  if (typeof darkQuery.addEventListener === 'function') darkQuery.addEventListener('change', onSystemAppearanceChange);
  else if (typeof darkQuery.addListener === 'function') darkQuery.addListener(onSystemAppearanceChange);

  /* ---------------------------------------------------------------------- */
  /* Tiroir d'historique (petites largeurs)                                 */
  /* ---------------------------------------------------------------------- */

  function drawerIsOpen() {
    return document.body.getAttribute('data-drawer') === 'open';
  }

  function openDrawer() {
    if (!drawerToggle) return;
    document.body.setAttribute('data-drawer', 'open');
    drawerToggle.setAttribute('aria-expanded', 'true');
    if (scrim) scrim.hidden = false;
    document.querySelector('#sidebar a, #sidebar button, #sidebar .history button')?.focus();
  }

  function closeDrawer(restoreFocus) {
    if (!drawerIsOpen()) return;
    document.body.removeAttribute('data-drawer');
    if (drawerToggle) {
      drawerToggle.setAttribute('aria-expanded', 'false');
      if (restoreFocus) drawerToggle.focus();
    }
    if (scrim) scrim.hidden = true;
  }

  drawerToggle?.addEventListener('click', () => (drawerIsOpen() ? closeDrawer(true) : openDrawer()));
  sidebarClose?.addEventListener('click', () => closeDrawer(true));
  scrim?.addEventListener('click', () => closeDrawer(true));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawerIsOpen()) closeDrawer(true);
  });

  /* ---------------------------------------------------------------------- */
  /* Messages                                                               */
  /* ---------------------------------------------------------------------- */

  function message(role, text) {
    const node = template.content.firstElementChild.cloneNode(true);
    const body = node.querySelector('.markdown');
    node.classList.add(role);
    node.dataset.index = String(document.querySelectorAll('.message').length);
    node.querySelector('.sender').textContent = role === 'user' ? 'Vous' : 'Assistant';
    node.querySelector('.avatar').textContent = role === 'user' ? 'V' : '◈';
    body.innerHTML = markdown(text || '');

    const copy = node.querySelector('.copy');
    if (role === 'user') {
      copy.remove();
    } else {
      copy.addEventListener('click', async () => {
        try {
          const text = body.innerText && body.innerText.trim() ? body.innerText : body.textContent;
          await navigator.clipboard.writeText(text);
          copy.textContent = 'Copié';
          copy.dataset.copied = 'true';
          announce('Réponse copiée dans le presse-papiers.');
          window.setTimeout(() => {
            copy.textContent = 'Copier';
            delete copy.dataset.copied;
          }, 2000);
        } catch (error) {
          announce('Copie impossible : le presse-papiers est indisponible.');
        }
      });
    }

    chat.append(node);
    document.querySelector('#welcome')?.remove();
    return node;
  }

  function addSources(node, sources) {
    const host = node.querySelector('.sources');
    host.replaceChildren();
    if (!sources.length) return;

    const details = document.createElement('details');
    details.className = 'sources-panel';
    details.open = true;

    const summary = document.createElement('summary');
    summary.textContent = 'Sources consultées (' + sources.length + ')';
    details.append(summary);

    const list = document.createElement('ol');
    list.className = 'source-list';

    sources.forEach((source, position) => {
      const item = document.createElement('li');
      item.className = 'source';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'source-toggle';
      button.setAttribute('aria-expanded', 'false');

      const index = document.createElement('span');
      index.className = 'source-index';
      index.textContent = '[' + (position + 1) + ']';

      const name = document.createElement('span');
      name.className = 'source-name';
      name.textContent = source.document;

      const meta = document.createElement('span');
      meta.className = 'source-meta';
      const parts = [];
      if (source.category) parts.push(source.category);
      if (typeof source.score === 'number') parts.push('pertinence ' + Math.round(source.score * 100) + ' %');
      meta.textContent = parts.join(' · ');

      const excerpt = document.createElement('p');
      excerpt.className = 'source-excerpt';
      excerpt.id = 'source-' + node.dataset.index + '-' + position;
      excerpt.hidden = true;
      excerpt.textContent = source.excerpt || '';

      button.setAttribute('aria-controls', excerpt.id);
      button.append(index, name);
      if (meta.textContent) button.append(meta);

      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', open ? 'false' : 'true');
        excerpt.hidden = open;
      });

      item.append(button, excerpt);
      list.append(item);
    });

    details.append(list);
    host.append(details);
  }

  function renderHistory() {
    if (!historyNav) return;
    const questions = messages.filter((entry) => entry.role === 'user');
    if (!questions.length) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = 'Vos questions apparaîtront ici pendant la conversation.';
      historyNav.replaceChildren(empty);
      return;
    }
    historyNav.replaceChildren(
      ...questions.map((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = entry.text;
        button.title = entry.text;
        button.setAttribute('aria-current', entry.active ? 'true' : 'false');
        button.addEventListener('click', () => {
          const target = chat.querySelector('.message[data-index="' + entry.index + '"]');
          if (target) {
            target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
          }
          messages.forEach((item) => {
            item.active = item === entry;
          });
          renderHistory();
          closeDrawer(false);
        });
        return button;
      })
    );
  }

  /* ---------------------------------------------------------------------- */
  /* États d'attente et d'erreur                                            */
  /* ---------------------------------------------------------------------- */

  function showPendingState(node) {
    const status = document.createElement('p');
    status.className = 'message-status';
    status.dataset.role = 'status';

    const dots = document.createElement('span');
    dots.className = 'loading-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));

    const text = document.createElement('span');
    text.textContent = 'Recherche dans les documents…';

    status.append(dots, text);
    node.querySelector('.message-content').insertBefore(status, node.querySelector('.markdown'));
    node.querySelector('.markdown').classList.add('loading');
    return text;
  }

  function clearPendingState(node) {
    node.querySelectorAll('.message-status').forEach((element) => element.remove());
    node.querySelector('.markdown').classList.remove('loading');
  }

  let focusReturnToInput = true;

  function showError(node, detail, onRetry) {
    focusReturnToInput = false;   /* le focus doit rester sur l'action de correction */
    clearPendingState(node);
    const body = node.querySelector('.markdown');
    body.replaceChildren();

    const block = document.createElement('div');
    block.className = 'error-block';
    block.setAttribute('role', 'alert');

    const title = document.createElement('p');
    title.className = 'error-title';
    title.textContent = 'Réponse indisponible';

    const text = document.createElement('p');
    text.className = 'error-detail';
    text.textContent = detail;

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'retry-button';
    retry.textContent = 'Réessayer';
    retry.addEventListener('click', onRetry);

    block.append(title, text, retry);
    body.append(block);
    retry.focus();
  }

  /* ---------------------------------------------------------------------- */
  /* Envoi et flux de réponse                                               */
  /* ---------------------------------------------------------------------- */

  function setBusy(busy) {
    send.disabled = busy;
    if (stop) stop.hidden = !busy;
    chat.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  async function streamAnswer(question, node) {
    controller = new AbortController();
    setBusy(true);

    const copyButton = node.querySelector('.copy');
    if (copyButton) copyButton.disabled = true; /* rien à copier tant que le flux n'est pas fini */

    const label = showPendingState(node);
    const body = node.querySelector('.markdown');
    let text = '';
    let sources = [];
    let frame = 0;
    let dirty = false;

    const paint = () => {
      frame = 0;
      if (!dirty) return;
      dirty = false;
      const follow = isNearBottom();
      body.innerHTML = markdown(text);
      if (follow) scrollToBottom(true);
    };

    const schedulePaint = () => {
      dirty = true;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question, stream: true }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = 'Le service de réponse est momentanément indisponible. Réessayez dans quelques instants.';
        try {
          const payload = await response.json();
          if (payload && payload.detail) detail = payload.detail;
        } catch (error) {
          /* réponse sans corps JSON : message générique conservé */
        }
        throw new Error(detail);
      }
      if (!response.body) throw new Error('Le navigateur ne prend pas en charge la réponse en flux.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const line = event.split('\n').find((candidate) => candidate.startsWith('data: '));
          if (!line) continue;
          let data;
          try {
            data = JSON.parse(line.slice(6));
          } catch (error) {
            continue;
          }
          if (data.type === 'sources') {
            sources = Array.isArray(data.sources) ? data.sources : [];
            addSources(node, sources);      /* affichées dès réception, pas à la fin */
            if (label) label.textContent = 'Rédaction de la réponse…';
          }
          if (data.type === 'token') {
            if (text === '' && label) label.textContent = 'Rédaction de la réponse…';
            text += data.content;
            schedulePaint();
          }
          if (data.type === 'error') throw new Error(data.message || 'La réponse a été interrompue.');
        }
      }

      if (frame) window.cancelAnimationFrame(frame);
      paint();
      clearPendingState(node);
      if (!text.trim()) {
        body.innerHTML = '<p>Le service n’a renvoyé aucun texte. Réessayez ou reformulez la question.</p>';
      }
      messages.push({ role: 'assistant', text: text, index: Number(node.dataset.index) });
      announce('Réponse terminée. ' + (sources.length === 1 ? '1 source consultée.' : sources.length + ' sources consultées.'));
    } catch (error) {
      if (frame) window.cancelAnimationFrame(frame);
      if (error && error.name === 'AbortError') {
        clearPendingState(node);
        if (text.trim()) {
          paint();
          messages.push({ role: 'assistant', text: text, index: Number(node.dataset.index) });
          announce('Génération arrêtée. La réponse partielle est conservée.');
        } else {
          node.remove();
          announce('Génération arrêtée.');
        }
      } else {
        const detail = (error && error.message) || 'Impossible d’obtenir une réponse pour le moment.';
        showError(node, detail, () => {
          node.remove();
          runAnswer(question);
        });
        announce('Erreur : ' + detail);
      }
    } finally {
      if (copyButton) copyButton.disabled = false;
      controller = null;
      setBusy(false);
      if (focusReturnToInput) input.focus();
      focusReturnToInput = true;
    }
  }

  function runAnswer(question) {
    const node = message('assistant', '');
    scrollToBottom(true);
    streamAnswer(question, node);
  }

  function ask(rawQuestion) {
    const question = String(rawQuestion || '').trim();
    if (!question || controller) return;

    const index = document.querySelectorAll('.message').length;
    messages.forEach((entry) => {
      entry.active = false;
    });
    messages.push({ role: 'user', text: question, index: index, active: true });
    message('user', question);
    renderHistory();
    closeDrawer(false);

    input.value = '';
    resize();
    updateCount();
    runAnswer(question);
  }

  stop?.addEventListener('click', () => {
    if (controller) controller.abort();
  });

  /* ---------------------------------------------------------------------- */
  /* Composeur                                                              */
  /* ---------------------------------------------------------------------- */

  function resize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 192) + 'px';
    syncComposerHeight();
  }

  function updateCount() {
    if (!charCount) return;
    const length = input.value.length;
    if (length >= COUNT_THRESHOLD) {
      charCount.hidden = false;
      charCount.textContent = length + ' / ' + MAX_LENGTH;
      charCount.dataset.over = length >= MAX_LENGTH ? 'true' : 'false';
    } else {
      charCount.hidden = true;
      delete charCount.dataset.over;
    }
  }

  function syncComposerHeight() {
    if (!composerWrap) return;
    const height = Math.round(composerWrap.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--composer-height', height + 'px');
  }

  input.addEventListener('input', () => {
    resize();
    updateCount();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  document.querySelectorAll('[data-question]').forEach((button) => {
    button.addEventListener('click', () => ask(button.dataset.question));
  });

  /* ---------------------------------------------------------------------- */
  /* Nouvelle conversation                                                  */
  /* ---------------------------------------------------------------------- */

  function newChat() {
    if (controller) controller.abort();
    messages = [];
    document.querySelectorAll('.message').forEach((node) => node.remove());
    if (welcomeTemplate && !document.querySelector('#welcome')) {
      chat.prepend(welcomeTemplate.cloneNode(true));
      document.querySelectorAll('#welcome [data-question]').forEach((button) => {
        button.addEventListener('click', () => ask(button.dataset.question));
      });
    }
    renderHistory();
    if (liveStatus) liveStatus.textContent = '';
    closeDrawer(false);
    input.value = '';
    resize();
    updateCount();
    input.focus();
  }

  document.querySelector('#new-chat')?.addEventListener('click', newChat);
  document.querySelector('#mobile-new-chat')?.addEventListener('click', newChat);

  /* ---------------------------------------------------------------------- */
  /* Démarrage                                                              */
  /* ---------------------------------------------------------------------- */

  window.addEventListener('resize', syncComposerHeight);
  if ('ResizeObserver' in window && composerWrap) {
    new ResizeObserver(syncComposerHeight).observe(composerWrap);
  }
  renderHistory();
  resize();
  updateCount();
})();

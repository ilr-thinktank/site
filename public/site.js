// Enhance the contact form; native POST to Formspree still works without JS.
const contactForm = document.querySelector('[data-contact-form]');
if (contactForm) {
  const status = document.querySelector('[data-contact-status]');
  const button = contactForm.querySelector('button[type="submit"]');
  contactForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !contactForm.reportValidity()) return;
    const body = new FormData(contactForm);
    button.disabled = true;
    button.textContent = 'Envoi en cours…';
    contactForm.setAttribute('aria-busy', 'true');
    status.className = '';
    status.textContent = 'Envoi en cours…';
    try {
      const response = await fetch(contactForm.action, {
        method: 'POST', body, headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error('Submission failed');
      contactForm.reset();
      status.className = 'ilr-contact-success';
      status.textContent = 'Merci ! Votre message a bien été envoyé.';
    } catch {
      status.className = 'ilr-contact-error';
      status.textContent = 'L’envoi n’a pas pu être confirmé. Votre message a été conservé dans le formulaire. Vérifiez votre connexion et réessayez dans quelques instants.';
    } finally {
      button.disabled = false;
      button.textContent = 'Envoyer le message';
      contactForm.removeAttribute('aria-busy');
    }
  });
}

// Client-side search/filtering: no WordPress AJAX or server required.
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
// The Productions page adds category toggles, cumulative theme chips, an author filter and a theme × category
// matrix; all combine, counts follow the current selection, and the state is mirrored in the URL
// (?q=&categories=&theme=&theme=&auteur=) for sharing.
for (const list of document.querySelectorAll('[data-content-list]')) {
  const query = list.querySelector('[data-content-query]');
  const category = list.querySelector('[data-content-category]');
  const toggles = [...list.querySelectorAll('[data-rubrique-toggle]')];
  const themeChips = [...list.querySelectorAll('[data-theme-filter]')];
  const author = list.querySelector('[data-author-filter]');
  const cells = [...list.querySelectorAll('[data-matrix-cell]')];
  const rows = [...list.querySelectorAll('[data-matrix-row]')];
  const status = list.querySelector('[data-content-status]');
  const reset = list.querySelector('[data-filter-reset]');
  const syncUrl = list.hasAttribute('data-sync-url');
  if (!query) continue;
  const cards = [...list.querySelectorAll('[data-content-card]')].map(element => ({
    element,
    rubrique: element.dataset.rubrique,
    author: element.dataset.author,
    category: element.dataset.category,
    themes: (element.dataset.themes ?? '').split('|').filter(Boolean),
    text: normalize(`${element.textContent} ${element.dataset.search ?? ''}`),
  }));
  const themes = new Set();
  const pressed = el => el.getAttribute('aria-pressed') !== 'false';
  const showOnly = names => { for (const t of toggles) t.setAttribute('aria-pressed', String(names.includes(t.dataset.rubriqueToggle))); };
  const plural = n => `${n} production${n > 1 ? 's' : ''}`;
  const update = () => {
    const terms = normalize(query.value).trim().split(/\s+/).filter(Boolean);
    const shown = toggles.filter(pressed).map(t => t.dataset.rubriqueToggle);
    const hiddenRubriques = new Set(toggles.filter(t => !pressed(t)).map(t => t.dataset.rubriqueToggle));
    // A facet's count leaves out its own filter, so it shows what choosing it would give.
    const passes = (card, { skip, addTheme } = {}) => terms.every(term => card.text.includes(term))
      && !(category && category.value && card.category !== category.value)
      && (skip === 'format' || !hiddenRubriques.has(card.rubrique))
      && (skip === 'author' || !author?.value || card.author === author.value)
      && [...themes, ...(addTheme ? [addTheme] : [])].every(theme => card.themes.includes(theme));
    const count = (options, keep = () => true) => cards.filter(card => keep(card) && passes(card, options)).length;
    let visible = 0;
    for (const card of cards) {
      card.element.hidden = !passes(card);
      if (!card.element.hidden) visible++;
    }
    for (const chip of themeChips) {
      const theme = chip.dataset.themeFilter;
      const active = theme ? themes.has(theme) : themes.size === 0;
      chip.setAttribute('aria-pressed', String(active));
      if (!theme) continue;
      const n = count({ addTheme: theme });
      chip.querySelector('small').textContent = n;
      chip.disabled = !active && n === 0;
    }
    for (const toggle of toggles) {
      toggle.querySelector('small').textContent = count({ skip: 'format' }, card => card.rubrique === toggle.dataset.rubriqueToggle);
    }
    for (const option of author ? author.options : []) {
      if (!option.value) continue;
      const n = count({ skip: 'author' }, card => card.author === option.value);
      option.textContent = `${option.value} (${n})`;
      option.disabled = n === 0 && !option.selected;
    }
    const counts = cells.map(cell => count({ skip: 'format', addTheme: cell.dataset.theme }, card => card.rubrique === cell.dataset.rubrique));
    const max = Math.max(1, ...counts);
    cells.forEach((cell, i) => {
      const n = counts[i];
      cell.hidden = n === 0;
      cell.nextElementSibling.hidden = n > 0;
      cell.querySelector('span').textContent = n;
      cell.style.setProperty('--s', (0.35 + 0.65 * n / max).toFixed(2));
      cell.setAttribute('aria-label', `${cell.dataset.theme} × ${cell.dataset.rubrique} : ${plural(n)}`);
      cell.classList.toggle('is-active', themes.has(cell.dataset.theme) && shown.length === 1 && shown[0] === cell.dataset.rubrique);
    });
    for (const row of rows) row.classList.toggle('is-selected', themes.has(row.dataset.matrixRow));
    list.querySelector('[data-content-empty]').hidden = visible > 0;
    const filtering = terms.length > 0 || hiddenRubriques.size > 0 || themes.size > 0 || Boolean(author?.value);
    if (status) status.textContent = `${plural(visible)}${filtering ? ` sur ${cards.length}` : ''}`;
    if (reset) reset.hidden = !filtering;
    if (syncUrl) {
      const params = new URLSearchParams();
      if (query.value.trim()) params.set('q', query.value.trim());
      if (hiddenRubriques.size) params.set('categories', shown.join(','));
      for (const theme of themes) params.append('theme', theme);
      if (author?.value) params.set('auteur', author.value);
      history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    }
  };
  if (syncUrl) {
    const params = new URLSearchParams(location.search);
    query.value = params.get('q') ?? '';
    for (const theme of params.getAll('theme')) if (themeChips.some(chip => chip.dataset.themeFilter === theme)) themes.add(theme);
    if (author && [...author.options].some(o => o.value === params.get('auteur'))) author.value = params.get('auteur');
    if (params.get('categories')) showOnly(params.get('categories').split(','));
  }
  query.addEventListener('input', update);
  category?.addEventListener('change', update);
  author?.addEventListener('change', update);
  for (const toggle of toggles) {
    toggle.addEventListener('click', () => {
      toggle.setAttribute('aria-pressed', String(!pressed(toggle)));
      update();
    });
  }
  for (const chip of themeChips) {
    chip.addEventListener('click', () => {
      const theme = chip.dataset.themeFilter;
      if (!theme) themes.clear();
      else if (!themes.delete(theme)) themes.add(theme);
      update();
    });
  }
  for (const cell of cells) {
    cell.addEventListener('click', () => {
      if (cell.classList.contains('is-active')) {
        themes.delete(cell.dataset.theme);
        showOnly(toggles.map(t => t.dataset.rubriqueToggle));
      } else {
        themes.add(cell.dataset.theme);
        showOnly([cell.dataset.rubrique]);
      }
      update();
    });
  }
  reset?.addEventListener('click', () => {
    query.value = '';
    themes.clear();
    if (author) author.value = '';
    showOnly(toggles.map(t => t.dataset.rubriqueToggle));
    update();
  });
  if (syncUrl) update();
}

// Transcript timestamps seek the article's player (audio/video file, YouTube or Vimeo).
for (const button of document.querySelectorAll('[data-seek]')) {
  button.addEventListener('click', () => {
    const seconds = Number(button.dataset.seek);
    const element = document.querySelector('[data-media-element]');
    const frame = document.querySelector('[data-media] iframe');
    if (element) {
      element.currentTime = seconds;
      element.play();
    } else if (frame?.parentElement.dataset.media === 'youtube') {
      for (const [func, args] of [['seekTo', [seconds, true]], ['playVideo', []]]) {
        frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube-nocookie.com');
      }
    } else if (frame?.parentElement.dataset.media === 'vimeo') {
      frame.contentWindow.postMessage({ method: 'setCurrentTime', value: seconds }, 'https://player.vimeo.com');
      frame.contentWindow.postMessage({ method: 'play' }, 'https://player.vimeo.com');
    }
    (element ?? frame)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

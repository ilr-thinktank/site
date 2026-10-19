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
// The Productions page adds category toggles, theme chips, an author filter and a theme × category
// matrix; all combine, and its state is mirrored in the URL (?q=&categories=&theme=&auteur=) for sharing.
for (const list of document.querySelectorAll('[data-content-list]')) {
  const query = list.querySelector('[data-content-query]');
  const category = list.querySelector('[data-content-category]');
  const toggles = [...list.querySelectorAll('[data-rubrique-toggle]')];
  const themeChips = [...list.querySelectorAll('[data-theme-filter]')];
  const author = list.querySelector('[data-author-filter]');
  const cells = [...list.querySelectorAll('[data-matrix-cell]')];
  const status = list.querySelector('[data-content-status]');
  const reset = list.querySelector('[data-filter-reset]');
  const syncUrl = list.hasAttribute('data-sync-url');
  if (!query) continue;
  const cards = [...list.querySelectorAll('[data-content-card]')];
  let theme = '';
  const pressed = el => el.getAttribute('aria-pressed') !== 'false';
  const showOnly = names => { for (const t of toggles) t.setAttribute('aria-pressed', String(names.includes(t.dataset.rubriqueToggle))); };
  const update = () => {
    const terms = normalize(query.value).trim().split(/\s+/).filter(Boolean);
    const shown = toggles.filter(pressed).map(t => t.dataset.rubriqueToggle);
    const hiddenRubriques = new Set(toggles.filter(t => !pressed(t)).map(t => t.dataset.rubriqueToggle));
    let visible = 0;
    for (const card of cards) {
      const text = normalize(`${card.textContent} ${card.dataset.search ?? ''}`);
      card.hidden = !terms.every(term => text.includes(term))
        || Boolean(category && category.value && card.dataset.category !== category.value)
        || hiddenRubriques.has(card.dataset.rubrique)
        || Boolean(theme && !(card.dataset.themes ?? '').split('|').includes(theme))
        || Boolean(author && author.value && card.dataset.author !== author.value);
      if (!card.hidden) visible++;
    }
    for (const chip of themeChips) chip.setAttribute('aria-pressed', String(chip.dataset.themeFilter === theme));
    for (const cell of cells) cell.classList.toggle('is-active', cell.dataset.theme === theme && shown.length === 1 && shown[0] === cell.dataset.rubrique);
    list.querySelector('[data-content-empty]').hidden = visible > 0;
    const filtering = terms.length > 0 || hiddenRubriques.size > 0 || Boolean(theme) || Boolean(author?.value);
    if (status) status.textContent = `${visible} production${visible > 1 ? 's' : ''}${filtering ? ` sur ${cards.length}` : ''}`;
    if (reset) reset.hidden = !filtering;
    if (syncUrl) {
      const params = new URLSearchParams();
      if (query.value.trim()) params.set('q', query.value.trim());
      if (hiddenRubriques.size) params.set('categories', shown.join(','));
      if (theme) params.set('theme', theme);
      if (author?.value) params.set('auteur', author.value);
      history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    }
  };
  if (syncUrl) {
    const params = new URLSearchParams(location.search);
    query.value = params.get('q') ?? '';
    if (themeChips.some(chip => chip.dataset.themeFilter === params.get('theme'))) theme = params.get('theme');
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
      theme = theme === chip.dataset.themeFilter ? '' : chip.dataset.themeFilter;
      update();
    });
  }
  for (const cell of cells) {
    cell.addEventListener('click', () => {
      theme = cell.dataset.theme;
      showOnly([cell.dataset.rubrique]);
      update();
      list.querySelector('.ilr-content-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  reset?.addEventListener('click', () => {
    query.value = '';
    theme = '';
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

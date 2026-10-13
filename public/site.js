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
for (const list of document.querySelectorAll('[data-content-list]')) {
  const query = list.querySelector('[data-content-query]');
  const category = list.querySelector('[data-content-category]');
  if (!query) continue;
  const cards = [...list.querySelectorAll('[data-content-card]')];
  const update = () => {
    const terms = normalize(query.value).trim().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const card of cards) {
      const text = normalize(card.textContent);
      card.hidden = !terms.every(term => text.includes(term)) || Boolean(category.value && card.dataset.category !== category.value);
      if (!card.hidden) visible++;
    }
    list.querySelector('[data-content-empty]').hidden = visible > 0;
  };
  query.addEventListener('input', update);
  category.addEventListener('change', update);
}

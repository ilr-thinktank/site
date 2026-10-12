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

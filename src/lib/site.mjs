import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import YAML from 'yaml';

export const routes = ['linstitut', 'devenir-adherent', 'nos-evenements', 'publications', 'contact'];
const reserved = new Set([...routes, 'admin', 'evenements', 'media', 'wp-content', 'wp-includes']);
export const base = () => (process.env.SITE_BASE || '/').replace(/\/$/, '');
export const local = path => `${base()}/${path.replace(/^\//, '')}`;
export function escape(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function markdown(body) {
  return sanitizeHtml(marked.parse(body || ''), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt', 'title', 'width', 'height', 'loading'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
  });
}
export function published(entries, now = new Date()) {
  return entries.filter(e => !e.data.draft && (e.collection === 'events' || e.data.date <= now))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
export function validateSlugs(articles, events) {
  const seen = new Set();
  for (const e of articles) {
    if (reserved.has(e.data.slug) || seen.has(e.data.slug)) throw new Error(`Reserved or duplicate article slug: ${e.data.slug}`);
    seen.add(e.data.slug);
  }
  const eventSlugs = new Set();
  for (const e of events) {
    if (eventSlugs.has(e.data.slug)) throw new Error(`Duplicate event slug: ${e.data.slug}`);
    eventSlugs.add(e.data.slug);
  }
}
export function entryUrl(e) {
  return local(`${e.collection === 'events' ? 'evenements/' : ''}${e.data.slug}/`);
}
const formatDate = date => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
function card(e) {
  const d = e.data;
  return `<article class="ilr-content-card" data-content-card data-category="${escape(d.category)}">
    ${d.image ? `<a href="${entryUrl(e)}" tabindex="-1" aria-hidden="true"><img src="${escape(d.image)}" alt="" loading="lazy"></a>` : ''}
    <div class="ilr-card-copy"><p class="ilr-card-category">${escape(d.category)}</p>
    <h2><a href="${entryUrl(e)}">${escape(d.title)}</a></h2>
    <p><time datetime="${d.date.toISOString()}">${formatDate(d.date)}</time>${d.author ? ` · ${escape(d.author)}` : ''}</p>
    ${d.location ? `<p>${escape(d.location)}</p>` : ''}
    <p>${escape(d.description)}</p><a href="${entryUrl(e)}">Consulter →</a></div></article>`;
}
export function listing(entries, { search = true, empty = 'Aucune publication pour le moment.', label = 'Rechercher', id = 'content' } = {}) {
  const categories = [...new Set(entries.map(e => e.data.category))];
  return `<div class="ilr-content-list" data-content-list>
    ${search ? `<div class="ilr-search"><label for="${id}-query">${label}</label><input id="${id}-query" type="search" data-content-query placeholder="${label}…"><label for="${id}-category">Catégorie</label><select id="${id}-category" data-content-category><option value="">Toutes les catégories</option>${categories.map(c => `<option>${escape(c)}</option>`).join('')}</select></div>` : ''}
    <div class="ilr-content-grid">${entries.map(card).join('')}</div>
    <p data-content-empty ${entries.length ? 'hidden' : ''}>${escape(empty)}</p></div>`;
}
function loadTemplate(name) {
  let html = readFileSync(`src/templates/${name}.html`, 'utf8');
  html = html.replace('<!-- shared header -->', readFileSync('src/templates/header.html', 'utf8'))
    .replace('<!-- shared footer -->', readFileSync('src/templates/footer.html', 'utf8'));
  return load(html);
}
function finalize($, sourceRoute, { title, description = '', image = '', path, article } = {}) {
  $('script[type="application/ld+json"], script[type="speculationrules"]').remove();
  $('link[rel="https://api.w.org/"], link[rel="EditURI"], link[type="application/json"], link[type="application/json+oembed"], link[type="text/xml+oembed"], link[rel="shortlink"]').remove();
  $('[class*="current-menu"], .current_page_item, .wpr-active-menu-item').removeClass('current-menu-item current_page_item wpr-active-menu-item');
  $('a[aria-current]').removeAttr('aria-current');
  const docUrl = new URL(`https://raison-institut.fr/${sourceRoute ? sourceRoute + '/' : ''}`);
  // Original header/footer contain home-relative media. They are now shared.
  $('[data-elementor-id="28"], [data-elementor-id="76"]').find('[src], [srcset], [href]').each((_, el) => {
    for (const attr of ['src', 'href']) {
      const v = $(el).attr(attr);
      if (v && !/^(?:[a-z]+:|\/|#)/i.test(v)) $(el).attr(attr, '/' + v.replace(/^(?:\.\.\/|\.\/)+/, ''));
    }
    const set = $(el).attr('srcset');
    if (set) $(el).attr('srcset', set.replace(/(?:\.\.\/|\.\/)+/g, '/'));
  });
  const fix = value => {
    if (!value || /^(?:#|mailto:|tel:|data:|javascript:)/i.test(value)) return value;
    if (value.startsWith(local('')) && base() && value.startsWith(base() + '/')) return value;
    const u = new URL(value, docUrl);
    if (u.hostname !== 'raison-institut.fr') return value;
    return local(u.pathname.replace('/index.php/', '/')) + u.search + u.hash;
  };
  $('*').each((_, el) => {
    for (const a of ['href', 'src', 'poster', 'data-src', 'data-url']) {
      const v = $(el).attr(a); if (v) $(el).attr(a, fix(v));
    }
    const set = $(el).attr('srcset');
    if (set) $(el).attr('srcset', set.split(',').map(s => { const [u, ...rest] = s.trim().split(/\s+/); return [fix(u), ...rest].join(' '); }).join(', '));
  });
  const navigationRoute = article ? (article.collection === 'events' ? 'nos-evenements/' : 'publications/') : (sourceRoute ? `${sourceRoute}/` : '');
  $('.wpr-nav-menu a, .wpr-mobile-nav-menu a').each((_, el) => {
    if ($(el).attr('href') === local(navigationRoute)) $(el).addClass('wpr-active-menu-item').attr('aria-current', article ? 'true' : 'page');
  });
  const pagePath = path ?? (sourceRoute ? `${sourceRoute}/` : '');
  const canonical = 'https://raison-institut.fr/' + pagePath;
  $('link[rel="canonical"]').remove();
  $('head').append(`<link rel="canonical" href="${canonical}">`);
  if (title) {
    $('title').text(`${title} — Institut La Raison`);
    $('meta[property="og:title"], meta[name="twitter:title"]').attr('content', title);
  }
  $('meta[property="og:url"]').attr('content', canonical);
  if (description) $('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]').attr('content', description);
  $('meta[property="og:image"], meta[name="twitter:image"]').remove();
  if (image) $('head').append(`<meta property="og:image" content="${escape(new URL(image, 'https://raison-institut.fr').href)}">`);
  if (article) $('head').append(`<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': article.collection === 'events' ? 'Event' : 'Article', name: title, headline: title, description, url: canonical, ...(article.collection === 'events' ? { startDate: article.data.date.toISOString(), location: { '@type': 'Place', name: article.data.location } } : { datePublished: article.data.date.toISOString(), author: { '@type': 'Person', name: article.data.author } }) }).replace(/</g, '\\u003c')}</script>`);
  $('head').append(`<link rel="stylesheet" href="${local('site.css')}">`);
  $('body').append(`<script src="${local('site.js')}" defer></script>`);
  let html = $.html();
  // Legacy runtime configuration and inline fonts contain document-relative URLs.
  html = html.replace(/(?:\.\.\/|\.\/)+(wp-content|wp-includes)\//g, (_, folder) => local(folder + '/'));
  html = html.replace(/url\((['"]?)\/(wp-content|wp-includes)\//g, (_, quote, folder) => `url(${quote}${local(folder + '/')}`);
  return html;
}
export function renderPage(route, articles, events) {
  const $ = loadTemplate(route || 'home');
  if (route === 'publications') {
    $('.elementor-element-b01dcef').html(listing(articles, { label: 'Rechercher une publication', id: 'publications' }));
    $('.elementor-element-e048bce').remove();
  } else if (route === 'nos-evenements') {
    $('.elementor-element-fa75b21').html(listing(events, { label: 'Rechercher un événement', empty: 'Aucun événement pour le moment.', id: 'events' }));
    $('.elementor-element-5531286').remove();
  } else if (!route) {
    const home = YAML.parse(readFileSync('content/settings/home.yml', 'utf8'));
    $('.elementor-element-c4f20c8 .elementor-heading-title').text(home.title);
    $('.elementor-element-edd70eb .elementor-heading-title').text(home.introTitle);
    $('.elementor-element-90d741d').html(markdown(home.introBody));
    $('.elementor-element-3318b44').html(listing(articles.slice(0, 3), { search: false }));
    for (const [id, category] of [['94f06af','Conférence'], ['c6dc1c0','Audience'], ['abe7acb','Commission de travail']]) {
      $(`.elementor-element-${id}`).html(listing(events.filter(e => e.data.category === category).slice(0, 3), { search: false, empty: 'Aucun événement pour le moment.' }));
    }
  }
  return finalize($, route);
}
export function renderEntry(e) {
  const $ = loadTemplate('penser-la-situation');
  const d = e.data;
  $('.elementor-element-b7a433b .elementor-heading-title').text(d.title);
  const byline = e.collection === 'events'
    ? `<p><time datetime="${d.date.toISOString()}">${formatDate(d.date)}</time>${d.location ? `<br>${escape(d.location)}` : ''}</p>`
    : `<p>par <strong>${escape(d.author)}</strong>${d.authorRole ? `<br><em>${escape(d.authorRole)}</em>` : ''}</p>`;
  $('.elementor-element-da02cea').html(byline);
  $('.elementor-element-f36b3cf').html(markdown(e.body)
    + (d.pdf ? `<p><a href="${escape(d.pdf)}">Télécharger le PDF</a></p>` : '')
    + (d.registrationUrl ? `<p><a href="${escape(d.registrationUrl)}" rel="noopener noreferrer">S’inscrire</a></p>` : ''));
  return finalize($, 'penser-la-situation', { title: d.title, description: d.description, image: d.image, path: `${e.collection === 'events' ? 'evenements/' : ''}${d.slug}/`, article: e });
}

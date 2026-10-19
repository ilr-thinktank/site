import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import YAML from 'yaml';

export const routes = ['linstitut', 'devenir-adherent', 'nos-evenements', 'productions', 'contact'];
const reserved = new Set([...routes, 'publications', 'admin', 'evenements', 'media', 'wp-content', 'wp-includes']);
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
// Production categories, in display order, with their icons. Keep in sync with the CMS and content schema.
// The older format field (Essai court, Tribune…) is kept in the content but not displayed for now.
export const rubriques = [
  ['Audiences', '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/>'],
  ['Bancs d’essai', '<path d="M2 15h20M4 15v6M20 15v6M4 19h16"/><path d="M6.5 15a5.5 5.5 0 0 1 11 0"/><path d="M12 15l3-3.5"/>'],
  ['Raisons d’État', '<path d="M3 9l9-6 9 6z"/><path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18M4 18h16"/>'],
  ['Angles morts', '<path d="M2 12s3.5-7 10-7c2 0 3.7.6 5.1 1.5M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.1-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/>'],
];
const icon = name => {
  const paths = rubriques.find(([n]) => n === name)?.[1];
  return paths ? `<svg class="ilr-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>` : '';
};
// Links into the Productions page with filters preset (shareable URLs read by site.js).
export const productionsUrl = (param, value) => `${local('productions/')}?${param}=${encodeURIComponent(value)}`;
const themesOf = d => d.themes ?? [];
function card(e) {
  const d = e.data;
  const label = d.rubrique || d.category;
  // Hidden from view but searchable: themes and transcript text.
  const searchExtra = [...themesOf(d), ...(d.transcript ?? []).flatMap(s => [s.heading, s.text])].join(' ');
  const attrs = d.rubrique ? ` data-rubrique="${escape(d.rubrique)}" data-themes="${escape(themesOf(d).join('|'))}" data-author="${escape(d.author)}" data-search="${escape(searchExtra)}"` : '';
  const author = d.author ? (d.rubrique ? ` · <a class="ilr-card-author" href="${productionsUrl('auteur', d.author)}">${escape(d.author)}</a>` : ` · ${escape(d.author)}`) : '';
  return `<article class="ilr-content-card" data-content-card data-category="${escape(d.category)}"${attrs}>
    ${d.image ? `<a href="${entryUrl(e)}" tabindex="-1" aria-hidden="true"><img src="${escape(d.image)}" alt="" loading="lazy"></a>` : ''}
    <div class="ilr-card-copy"><p class="ilr-card-category">${icon(d.rubrique)}<span>${escape(label)}</span>${d.transcript?.length ? '<span class="ilr-card-badge">Transcription</span>' : ''}</p>
    <h2><a href="${entryUrl(e)}">${escape(d.title)}</a></h2>
    <p><time datetime="${d.date.toISOString()}">${formatDate(d.date)}</time>${author}</p>
    ${d.location ? `<p>${escape(d.location)}</p>` : ''}
    <p>${escape(d.description)}</p>
    ${themesOf(d).length ? `<p class="ilr-card-themes">${themesOf(d).map(escape).join(' · ')}</p>` : ''}
    <a href="${entryUrl(e)}">Consulter →</a></div></article>`;
}
const countBy = (items, key) => {
  const counts = new Map();
  for (const item of items) for (const k of [key(item)].flat()) if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));
};
// Productions page: search, category toggles, theme chips, author filter and a Thèmes × Catégories bubble matrix.
// All filters combine; site.js keeps them in the URL so a filtered view can be shared.
export function productionsListing(articles, { label = 'Rechercher une production', id = 'productions' } = {}) {
  const themes = countBy(articles, e => themesOf(e.data));
  const authors = countBy(articles, e => e.data.author).sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  const cell = (theme, name) => articles.filter(e => e.data.rubrique === name && themesOf(e.data).includes(theme)).length;
  const max = Math.max(1, ...themes.flatMap(([theme]) => rubriques.map(([name]) => cell(theme, name))));
  const matrix = themes.length ? `<details class="ilr-explorer" open><summary>Explorer : thèmes × catégories</summary>
    <table class="ilr-matrix"><caption>Nombre de productions par thème et par catégorie. Cliquez sur une bulle pour filtrer.</caption>
    <thead><tr><th scope="col">Thème</th>${rubriques.map(([name]) => `<th scope="col" title="${escape(name)}">${icon(name)}<span class="ilr-sr">${escape(name)}</span></th>`).join('')}</tr></thead>
    <tbody>${themes.map(([theme]) => `<tr><th scope="row">${escape(theme)}</th>${rubriques.map(([name]) => {
      const n = cell(theme, name);
      return `<td>${n ? `<button type="button" class="ilr-bubble" data-matrix-cell data-theme="${escape(theme)}" data-rubrique="${escape(name)}" style="--s:${(0.35 + 0.65 * n / max).toFixed(2)}" aria-label="${escape(theme)} × ${escape(name)} : ${n} production${n > 1 ? 's' : ''}"><span>${n}</span></button>` : '<span class="ilr-bubble-empty" aria-hidden="true"></span>'}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></details>` : '';
  return `<div class="ilr-content-list" data-content-list data-sync-url>
    <div class="ilr-search"><label for="${id}-query">${label}</label><input id="${id}-query" type="search" data-content-query placeholder="${label}…">
    <div class="ilr-toggles" role="group" aria-label="Afficher ou masquer les catégories">${rubriques.map(([name]) => `<button type="button" class="ilr-toggle" data-rubrique-toggle="${escape(name)}" aria-pressed="true" title="Afficher ou masquer : ${escape(name)}">${icon(name)}<span>${escape(name)}</span><small>${articles.filter(e => e.data.rubrique === name).length}</small></button>`).join('')}</div>
    ${themes.length ? `<div class="ilr-chips" role="group" aria-label="Filtrer par thème"><button type="button" class="ilr-chip" data-theme-filter="" aria-pressed="true">Tous les thèmes</button>${themes.map(([theme, n]) => `<button type="button" class="ilr-chip" data-theme-filter="${escape(theme)}" aria-pressed="false">${escape(theme)} <small>${n}</small></button>`).join('')}</div>` : ''}
    <div class="ilr-filter-row"><label for="${id}-author">Auteur</label><select id="${id}-author" data-author-filter><option value="">Tous les auteurs</option>${authors.map(([a, n]) => `<option value="${escape(a)}">${escape(a)} (${n})</option>`).join('')}</select>
    <p class="ilr-status" data-content-status aria-live="polite">${articles.length} production${articles.length > 1 ? 's' : ''}</p><button type="button" class="ilr-reset" data-filter-reset hidden>Réinitialiser les filtres</button></div></div>
    ${matrix}
    <div class="ilr-content-grid">${articles.map(card).join('')}</div>
    <p data-content-empty ${articles.length ? 'hidden' : ''}>Aucune production pour le moment.</p></div>`;
}
const toSeconds = time => time.split(':').reduce((total, part) => total * 60 + Number(part), 0);
// Embeds a YouTube/Vimeo link or an audio/video file. Anything else is ignored.
export function mediaEmbed(url) {
  if (!url) return '';
  let u;
  try { u = new URL(url, 'https://raison-institut.fr'); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  const host = u.hostname.replace(/^(?:www|m)\./, '');
  const youtube = host === 'youtu.be' ? u.pathname.slice(1) : host === 'youtube.com' ? (u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1]) : null;
  if (youtube && /^[\w-]{11}$/.test(youtube)) return `<div class="ilr-media" data-media="youtube"><iframe src="https://www.youtube-nocookie.com/embed/${youtube}?enablejsapi=1" title="Lecteur vidéo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`;
  const vimeo = host === 'vimeo.com' && u.pathname.match(/^\/(\d+)/)?.[1];
  if (vimeo) return `<div class="ilr-media" data-media="vimeo"><iframe src="https://player.vimeo.com/video/${vimeo}" title="Lecteur vidéo" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  const src = escape(u.hostname === 'raison-institut.fr' ? local(u.pathname) : u.href);
  if (/\.(?:mp3|m4a|ogg|oga|wav)$/i.test(u.pathname)) return `<audio class="ilr-audio" controls preload="metadata" src="${src}" data-media-element></audio>`;
  if (/\.(?:mp4|webm)$/i.test(u.pathname)) return `<div class="ilr-media"><video controls preload="metadata" src="${src}" data-media-element></video></div>`;
  return '';
}
// Edited transcript with timestamps and headings; timestamps seek the player when there is one.
export function transcriptHtml(transcript, playable) {
  if (!transcript?.length) return '';
  return `<section class="ilr-transcript" aria-labelledby="transcription"><h2 id="transcription">Transcription</h2>
    ${transcript.map(s => {
      const seconds = toSeconds(s.time);
      const time = playable ? `<button type="button" class="ilr-time" data-seek="${seconds}" aria-label="Lire à partir de ${escape(s.time)}">${escape(s.time)}</button>` : `<span class="ilr-time">${escape(s.time)}</span>`;
      return `<div class="ilr-segment" id="t-${seconds}">${s.heading ? `<h3>${escape(s.heading)}</h3>` : ''}<div class="ilr-segment-body">${time}<div>${markdown(s.text)}</div></div></div>`;
    }).join('')}</section>`;
}
// Homepage showcase: the most recent article of each category, in category order (articles are sorted newest first).
export const latestByRubrique = articles => rubriques.map(([name]) => articles.find(e => e.data.rubrique === name)).filter(Boolean);
export function listing(entries, { search = true, empty = 'Aucune production pour le moment.', label = 'Rechercher', id = 'content' } = {}) {
  const categories = [...new Set(entries.map(e => e.data.category))];
  return `<div class="ilr-content-list" data-content-list>
    ${search ? `<div class="ilr-search"><label for="${id}-query">${label}</label><input id="${id}-query" type="search" data-content-query placeholder="${label}…"><label for="${id}-category">Catégorie</label><select id="${id}-category" data-content-category><option value="">Toutes les catégories</option>${categories.map(c => `<option>${escape(c)}</option>`).join('')}</select></div>` : ''}
    <div class="ilr-content-grid">${entries.map(card).join('')}</div>
    <p data-content-empty ${entries.length ? 'hidden' : ''}>${escape(empty)}</p></div>`;
}
// Content hash appended to shared assets so browsers fetch them again after each change.
const assetVersion = file => createHash('sha256').update(readFileSync(`public/${file}`)).digest('hex').slice(0, 10);
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
    if (set) $(el).attr('srcset', set.split(',').map(candidate => {
      const [url, ...descriptors] = candidate.trim().split(/\s+/);
      const rooted = /^(?:[a-z]+:|\/|#)/i.test(url) ? url : '/' + url.replace(/^(?:\.\.\/|\.\/)+/, '');
      return [rooted, ...descriptors].join(' ');
    }).join(', '));
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
  const navigationRoute = article ? (article.collection === 'events' ? 'nos-evenements/' : 'productions/') : (sourceRoute ? `${sourceRoute}/` : '');
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
  $('head').append(`<link rel="stylesheet" href="${local('site.css')}?v=${assetVersion('site.css')}">`);
  $('body').append(`<script src="${local('site.js')}?v=${assetVersion('site.js')}" defer></script>`);
  // Public measurement token, not an API secret. Shared by all public routes.
  $('body').append(`<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"34a4ac8284674ecabf4ab3c239eca7bb"}'></script>`);
  let html = $.html();
  // Legacy runtime configuration and inline fonts contain document-relative URLs.
  html = html.replace(/(?:\.\.\/|\.\/)+(wp-content|wp-includes)\//g, (_, folder) => local(folder + '/'));
  html = html.replace(/url\((['"]?)\/(wp-content|wp-includes)\//g, (_, quote, folder) => `url(${quote}${local(folder + '/')}`);
  return html;
}
export function renderPage(route, articles, events) {
  const $ = loadTemplate(route || 'home');
  if (route === 'productions') {
    $('.elementor-element-b01dcef').html(productionsListing(articles));
    $('.elementor-element-e048bce').remove();
  } else if (route === 'nos-evenements') {
    $('.elementor-element-fa75b21').html(listing(events, { label: 'Rechercher un événement', empty: 'Aucun événement pour le moment.', id: 'events' }));
    $('.elementor-element-5531286').remove();
  } else if (!route) {
    const home = YAML.parse(readFileSync('content/settings/home.yml', 'utf8'));
    $('.elementor-element-c4f20c8 .elementor-heading-title').text(home.title);
    $('.elementor-element-edd70eb .elementor-heading-title').text(home.introTitle);
    $('.elementor-element-90d741d').html(markdown(home.introBody));
    $('.elementor-element-3318b44').html(listing(latestByRubrique(articles), { search: false }));
    // Productions showcase (title band + grid) sits right after the hero, before « Qui sommes-nous ? ».
    $('.elementor-element-2c76323, .elementor-element-4638c42').insertBefore('.elementor-element-a7ca982');
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
    : `<p>par <strong><a class="ilr-author-link" href="${productionsUrl('auteur', d.author)}" title="Toutes les productions de cet auteur">${escape(d.author)}</a></strong>${d.authorRole ? `<br><em>${escape(d.authorRole)}</em>` : ''}</p>`
      + (d.rubrique ? `<p class="ilr-entry-tags"><a class="ilr-entry-category" href="${productionsUrl('categories', d.rubrique)}">${icon(d.rubrique)}<span>${escape(d.rubrique)}</span></a>${themesOf(d).map(t => `<a class="ilr-tag" href="${productionsUrl('theme', t)}">${escape(t)}</a>`).join('')}</p>` : '');
  $('.elementor-element-da02cea').html(byline);
  const player = e.collection === 'articles' ? mediaEmbed(d.media) : '';
  $('.elementor-element-f36b3cf').html(player + markdown(e.body)
    + (e.collection === 'articles' ? transcriptHtml(d.transcript, Boolean(player)) : '')
    + (d.pdf ? `<p><a href="${escape(d.pdf)}">Télécharger le PDF</a></p>` : '')
    + (d.registrationUrl ? `<p><a href="${escape(d.registrationUrl)}" rel="noopener noreferrer">S’inscrire</a></p>` : ''));
  return finalize($, 'penser-la-situation', { title: d.title, description: d.description, image: d.image, path: `${e.collection === 'events' ? 'evenements/' : ''}${d.slug}/`, article: e });
}

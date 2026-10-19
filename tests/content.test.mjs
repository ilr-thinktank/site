import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import YAML from 'yaml';
import { load } from 'cheerio';
import { published, validateSlugs, markdown, renderEntry, renderPage, listing, local, rubriques } from '../src/lib/site.mjs';
const entry = (overrides = {}, collection = 'articles') => ({ collection, body: '## Un titre\n\nTexte **important**.', data: { title: 'Une nouvelle publication', slug: 'une-nouvelle-publication', date: new Date('2026-01-01'), author: 'Auteur', authorRole: '', rubrique: 'Audiences', category: 'Essai court', image: '', pdf: '', description: 'Résumé', draft: false, ...overrides } });
test('draft and future articles are excluded; future events can be announced', () => {
 const a = entry(); const draft = entry({draft:true}); const future = entry({date:new Date('2099-01-01')}); const event = entry({date:new Date('2099-01-01')}, 'events');
 assert.deepEqual(published([a,draft,future,event],new Date('2026-10-12')), [event,a]);
});
test('duplicate/reserved URLs fail loudly instead of overwriting pages', () => {
 for (const slug of ['admin', 'productions', 'publications']) {
  assert.throws(() => validateSlugs([entry({slug})],[]));
 }
 assert.throws(() => validateSlugs([entry(),entry()],[]));
 assert.throws(() => validateSlugs([], [entry({},'events'),entry({},'events')]));
});
test('Markdown renders rich text and strips executable HTML', () => {
 const output = markdown('**Texte** <script>alert(1)</script> <img src="/media/photo.png" onerror="alert(1)"> [test](javascript:alert(1))');
 assert.match(output, /<strong>Texte<\/strong>/); assert.doesNotMatch(output, /<script|onerror|javascript:/);
 assert.match(output, /src="\/media\/photo.png"/);
});
test('new articles use reusable template and update metadata, PDF and image', () => {
 const html = renderEntry(entry({ title:'Titre <test>', pdf:'/media/document.pdf', image:'/media/photo.png' }));
 const $ = load(html);
 assert.equal($('h1').text().trim(),'Titre <test>');
 assert.match($('.elementor-element-f36b3cf').html(), /<strong>important<\/strong>/);
 assert.equal($('link[rel="canonical"]').attr('href'),'https://raison-institut.fr/une-nouvelle-publication/');
 assert.equal($('a[href="/media/document.pdf"]').length,1);
 assert.equal($('meta[property="og:image"]').attr('content'),'https://raison-institut.fr/media/photo.png');
});
test('Productions terminology, metadata and navigation are consistent', () => {
 const $ = load(renderPage('productions', [], []));
 assert.equal($('h1').text().trim(), 'Nos Productions');
 assert.equal($('link[rel="canonical"]').attr('href'), 'https://raison-institut.fr/productions/');
 assert.equal($('meta[property="og:url"]').attr('content'), 'https://raison-institut.fr/productions/');
 assert.match($('title').text(), /Productions/);
 assert.match($('meta[name="description"]').attr('content'), /productions/);
 assert.equal($('input[type="search"]').attr('placeholder'), 'Rechercher une production…');
 assert.equal($('[data-content-empty]').text(), 'Aucune production pour le moment.');
 for (const html of [renderPage('', [], []), $.html(), renderEntry(entry())]) {
  const page = load(html);
  assert.equal(page('a[href="/publications/"]').length, 0);
  assert.equal(page('.wpr-nav-menu a[href="/productions/"]').text(), 'Productions');
 }
 const article = load(renderEntry(entry()));
 assert.equal(article('.wpr-nav-menu a[href="/productions/"]').attr('aria-current'), 'true');
 const config = YAML.parse(readFileSync('public/admin/config.yml', 'utf8'));
 assert.equal(config.collections.find(c => c.name === 'articles').label, 'Productions');
});
test('Productions page shows category icons with one toggle per category', () => {
 const names = rubriques.map(([name]) => name);
 assert.deepEqual(names, ['Audiences', 'Bancs d’essai', 'Raisons d’État', 'Angles morts', 'Doléances']);
 const config = YAML.parse(readFileSync('public/admin/config.yml', 'utf8'));
 const fields = config.collections.find(c => c.name === 'articles').fields;
 assert.deepEqual(fields.find(f => f.name === 'rubrique').options, names);
 assert.equal(fields.find(f => f.name === 'category').widget, 'hidden');
 assert.match(readFileSync('src/content.config.ts', 'utf8'), new RegExp(`rubrique: z\\.enum\\(\\[${names.map(n => `'${n}'`).join(', ')}\\]\\)`));
 const $ = load(renderPage('productions', [entry({ slug: 'a', rubrique: 'Raisons d’État' }), entry({ slug: 'b', rubrique: 'Raisons d’État' })], []));
 assert.deepEqual($('[data-rubrique-toggle]').map((_, el) => $(el).attr('data-rubrique-toggle')).get(), names);
 assert.equal($('[data-rubrique-toggle][aria-pressed="true"]').length, 5);
 assert.equal($('[data-rubrique-toggle="Raisons d’État"] small').text(), '2');
 assert.equal($('[data-content-category]').length, 0);
 const card = $('[data-content-card]').first();
 assert.equal(card.attr('data-rubrique'), 'Raisons d’État');
 assert.equal(card.find('.ilr-card-category').text(), 'Raisons d’État');
 assert.equal(card.find('.ilr-card-category svg').length, 1);
 assert.doesNotMatch($('.ilr-content-grid').text(), /Essai court/);
});
test('Productions filters link themes, authors and categories, with a matrix', () => {
 const articles = [
  entry({ slug: 'a', rubrique: 'Audiences', author: 'Alice', themes: ['Europe', 'Souveraineté'] }),
  entry({ slug: 'b', rubrique: 'Audiences', author: 'Bob', themes: ['Europe'] }),
  entry({ slug: 'c', rubrique: 'Angles morts', author: 'Alice', themes: ['Économie'], transcript: [{ time: '01:05', heading: 'Ouverture', text: 'mot-introuvable-ailleurs' }] }),
 ];
 const $ = load(renderPage('productions', articles, []));
 assert.deepEqual($('[data-theme-filter]').map((_, el) => $(el).attr('data-theme-filter')).get(), ['', 'Europe', 'Économie', 'Souveraineté']);
 assert.deepEqual($('[data-author-filter] option').map((_, el) => $(el).attr('value')).get(), ['', 'Alice', 'Bob']);
 assert.equal($('[data-matrix-cell][data-theme="Europe"][data-rubrique="Audiences"] span').text(), '2');
 assert.equal($('[data-matrix-cell][data-theme="Europe"][data-rubrique="Angles morts"]').length, 0);
 const c = $('[data-content-card]').eq(2);
 assert.equal(c.attr('data-author'), 'Alice');
 assert.equal(c.attr('data-themes'), 'Économie');
 assert.match(c.attr('data-search'), /mot-introuvable-ailleurs/);
 assert.equal(c.find('.ilr-card-author').attr('href'), '/productions/?auteur=Alice');
 assert.equal(c.find('.ilr-card-badge').text(), 'Transcription');
 assert.ok($('[data-content-list]').is('[data-sync-url]'));
});
test('articles link back to filtered views and render media with a timed transcript', () => {
 const transcript = [{ time: '00:00', heading: 'Début', text: 'Bonjour **à tous**' }, { time: '1:02:03', heading: '', text: 'Fin' }];
 let $ = load(renderEntry(entry({ themes: ['Europe'], media: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', transcript })));
 assert.equal($('.ilr-author-link').attr('href'), '/productions/?auteur=Auteur');
 assert.equal($('.ilr-tag').attr('href'), '/productions/?theme=Europe');
 assert.equal($('.ilr-entry-category').attr('href'), `/productions/?categories=${encodeURIComponent('Audiences')}`);
 assert.match($('[data-media="youtube"] iframe').attr('src'), /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?enablejsapi=1$/);
 assert.deepEqual($('[data-seek]').map((_, el) => $(el).attr('data-seek')).get(), ['0', '3723']);
 assert.match($('.ilr-transcript').html(), /<strong>à tous<\/strong>/);
 $ = load(renderEntry(entry({ media: '/media/episode.mp3', transcript })));
 assert.equal($('audio[data-media-element]').attr('src'), '/media/episode.mp3');
 $ = load(renderEntry(entry({ media: 'javascript:alert(1)', transcript })));
 assert.equal($('[data-seek]').length, 0);
 assert.equal($('.ilr-time').length, 2);
 assert.equal($('iframe, audio, video').length, 0);
});
test('homepage showcases the most recent article of each category', () => {
 const a = (slug, rubrique, date) => entry({ slug, rubrique, date: new Date(date) });
 const articles = [a('am-new', 'Angles morts', '2026-05-03'), a('au-new', 'Audiences', '2026-05-02'), a('am-old', 'Angles morts', '2026-05-01'), a('au-old', 'Audiences', '2026-04-01'), a('re', 'Raisons d’État', '2026-03-01')];
 const $ = load(renderPage('', articles, []));
 const hrefs = $('.elementor-element-3318b44 [data-content-card] h2 a').map((_, el) => $(el).attr('href')).get();
 assert.deepEqual(hrefs, ['/au-new/', '/re/', '/am-new/']);
 const order = $('[data-elementor-id="7"] > *').map((_, el) => $(el).attr('data-id')).get();
 assert.deepEqual(order.slice(0, 4), ['d481d9f', '2c76323', '4638c42', 'a7ca982']);
});
test('events use separate URLs and include location and registration link', () => {
 const e = entry({slug:'conference-test',location:'Paris',registrationUrl:'https://example.org/inscription'},'events');
 const $ = load(renderEntry(e));
 assert.match($('.elementor-element-da02cea').text(), /Paris/);
 assert.equal($('a[href="https://example.org/inscription"]').length,1);
 assert.match($('link[rel="canonical"]').attr('href'),/\/evenements\/conference-test\/$/);
});
test('homepage and indexes list new entries automatically, with working filters', () => {
 const a=entry();
 for (const route of ['', 'productions']) {
  const $=load(renderPage(route,[a],[]));
  assert.equal($('[data-content-card]').length,1);
  assert.equal($('[data-content-card] a').first().attr('href'), '/une-nouvelle-publication/');
 }
 const $=load(renderPage('nos-evenements',[],[]));
 assert.match($('[data-content-empty]').text(), /Aucun événement/);
 assert.equal($('form').length,0);
});
test('shared logo sources resolve from the site root on every page', () => {
 for (const siteBase of ['', '/site']) {
  process.env.SITE_BASE = siteBase;
  try {
   for (const html of [renderPage('', [], []), ...['linstitut', 'devenir-adherent', 'nos-evenements', 'productions', 'contact'].map(route => renderPage(route, [], [])), renderEntry(entry()), renderEntry(entry({}, 'events'))]) {
    const $ = load(html);
    const expected = `${siteBase}/wp-content/uploads/2025/09/4-e1757158223140.png`;
    assert.equal($('.wpr-logo-image img').attr('src'), expected);
    const sources = $('.wpr-logo-image source');
    assert.equal(sources.length, 2);
    assert.equal(sources.first().attr('srcset'), expected);
    assert.equal(sources.last().attr('srcset'), `${expected} 1x, ${expected} 2x`);
   }
  } finally { delete process.env.SITE_BASE; }
 }
});
test('subdirectory hosting keeps assets and links under the configured base', () => {
 process.env.SITE_BASE='/site';
 try {
  const $=load(renderEntry(entry()));
  assert.equal($('img').first().attr('src'),'/site/wp-content/uploads/2025/09/4-e1757158223140.png');
  assert.equal($('a[rel="home"]').first().attr('href'),'/site/');
  assert.equal(local('media/photo.png'),'/site/media/photo.png');
 } finally {delete process.env.SITE_BASE;}
});
test('CMS collections match real content folders, safe defaults and media output', () => {
 const config=YAML.parse(readFileSync('public/admin/config.yml','utf8'));
 assert.equal(config.backend.repo,'ilr-thinktank/site');
 assert.equal(config.backend.branch,'main');
 assert.equal(config.backend.base_url,'https://ilr-cms-auth.ilr-site.workers.dev');
 assert.ok(config.backend.auth_methods.includes('oauth'));
 assert.equal(config.backend.auth_scope,'public_repo');
 for (const c of config.collections.filter(c=>c.folder)) {
  assert.ok(existsSync(c.folder));
  assert.equal(c.fields.find(f=>f.name==='draft').default,true);
  assert.ok(c.fields.some(f=>f.name==='body'));
 }
 assert.equal(config.media_folder,'public/media'); assert.equal(config.public_folder,'/media');
});
test('Cloudflare analytics is included once on public pages and entries', () => {
 for (const html of [renderPage('',[],[]), renderPage('contact',[],[]), renderEntry(entry()), renderEntry(entry({},'events'))]) {
  const $=load(html);
  const beacon=$('script[src="https://static.cloudflareinsights.com/beacon.min.js"]');
  assert.equal(beacon.length,1);
  assert.equal(beacon.attr('type'),'module');
  assert.equal(JSON.parse(beacon.attr('data-cf-beacon')).token,'34a4ac8284674ecabf4ab3c239eca7bb');
 }
});
test('contact posts to Formspree with accessible fields and a native fallback', () => {
 const html=renderPage('contact',[],[]);
 const $=load(html);
 const form=$('[data-contact-form]');
 assert.equal(form.attr('action'),'https://formspree.io/f/mnpjgvdl');
 assert.equal(form.attr('method'),'post');
 for (const name of ['name','email','message']) {
  const field=form.find(`[name="${name}"]`);
  assert.ok(field.is('[required]'));
  assert.equal($(`label[for="${field.attr('id')}"]`).length,1);
 }
 assert.equal(form.find('[name="email"]').attr('type'),'email');
 assert.equal(form.find('[name="_gotcha"]').length,1);
 assert.equal($('[data-contact-status]').attr('role'),'status');
 assert.doesNotMatch(html,/temporairement indisponible/);
});

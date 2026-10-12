// One-time migration from the original public HTML. No SQL or private data used.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { load } from 'cheerio';
import Turndown from 'turndown';
import YAML from 'yaml';
const td = new Turndown({ headingStyle: 'atx', bulletListMarker: '-' });
const $ = load(readFileSync('penser-la-situation/index.html', 'utf8'));
const body = td.turndown($('.elementor-element-f36b3cf').html());
const data = {
  title: 'Penser la situation', slug: 'penser-la-situation', date: '2026-03-06',
  author: 'André Bellon', authorRole: 'Ancien Président de la Commission des affaires étrangères de l’Assemblée nationale',
  category: 'Essai court', image: '/wp-content/uploads/2025/09/2.png',
  description: 'André Bellon interroge les nomenclatures politiques et la place de la souveraineté dans le débat démocratique.',
  draft: false,
};
writeFileSync('content/articles/penser-la-situation.md', `---\n${YAML.stringify(data)}---\n\n${body}\n`);
const home = load(readFileSync('index.html', 'utf8'));
writeFileSync('content/settings/home.yml', YAML.stringify({
  title: home('.elementor-element-c4f20c8 .elementor-heading-title').text().trim(),
  introTitle: home('.elementor-element-edd70eb .elementor-heading-title').text().trim(),
  introBody: td.turndown(home('.elementor-element-90d741d').html()),
}));
// Keep the empty events directory in Git. Draft examples are not published.
writeFileSync('content/events/.gitkeep', '');
console.log('Migrated existing article and homepage introduction. No draft WordPress posts published.');

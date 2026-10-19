import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://raison-institut.fr',
  base: process.env.SITE_BASE || '/',
  output: 'static',
  trailingSlash: 'always',
  redirects: {
    '/publications/': '/productions/',
    // Former URLs of the sample productions, renamed when they were written up.
    '/exemple-audiences-1/': '/entretien-jacques-coeur/',
    '/entretien-justinien-code/': '/entretien-jacques-coeur/',
    '/exemple-audiences-2/': '/entretien-sully/',
    '/exemple-audiences-3/': '/entretien-tocqueville/',
    '/exemple-bancs-dessai-1/': '/retour-du-septennat/',
    '/bouclier-dore-souverainete-numerique/': '/retour-du-septennat/',
    '/exemple-bancs-dessai-2/': '/vote-obligatoire/',
    '/exemple-bancs-dessai-3/': '/conseiller-territorial/',
    '/exemple-raisons-detat-1/': '/villers-cotterets-langue-etat/',
    '/villers-cotterets-langue-raison-detat/': '/villers-cotterets-langue-etat/',
    '/exemple-raisons-detat-2/': '/chaise-vide-1965/',
    '/exemple-raisons-detat-3/': '/colbert-manufactures/',
    '/exemple-angles-morts-1/': '/potentiel-portuaire-ultramarin/',
    '/exemple-angles-morts-2/': '/mal-inscrits/',
    '/exemple-angles-morts-3/': '/partis-politiques-europeens/',
  },
});

# Institut La Raison — Astro + Sveltia CMS

The existing design is preserved as reusable HTML shells. Astro builds static pages from editable Markdown and YAML; Sveltia provides the editing interface.

## One-time deployment setup

1. Open **Settings → Pages** in `ilr-thinktank/site`.
2. Change **Build and deployment → Source** to **GitHub Actions**. Keep the custom domain `raison-institut.fr` and HTTPS settings unchanged.
3. In **Actions → Build and publish website**, run the workflow (or push a change).
4. Once it succeeds, open `https://raison-institut.fr/admin/`.

The workflow builds and validates the site before deploying `dist/`. Each CMS save commits to `main`, triggering a rebuild. Failed builds leave the last successful deployment intact. PRs build/test without deploying.

The original root HTML/assets are retained temporarily so the existing branch-based deployment is not broken before the Pages source is switched. They are a legacy snapshot, **not editable source for the Astro site**. Do not edit them; remove them after the Actions deployment is verified. Only `dist/` is deployed by the new workflow.

## Editor login (initial setup)

The dashboard currently uses Sveltia's **Sign In with Token**, not an unconfigured OAuth button.

- Editors need a GitHub account with write access to `ilr-thinktank/site`.
- Create a **fine-grained personal access token**, limited to this repository, with **Contents: Read and write**. Metadata read is automatic. Set an expiration.
- Enter it only in the CMS login prompt on your HTTPS domain. **Never commit it or send it in chat.**
- Sveltia stores this token in that browser's local storage. Use a trusted computer; sign out after using a shared device. Revoke the token if compromised.
- This simple publishing workflow does not require Pull requests or Workflows permissions.

For easier nontechnical team login, deploy [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) on Cloudflare Workers, register a GitHub OAuth app, set `backend.base_url` in `public/admin/config.yml`, and change `auth_methods` to `[oauth]`. OAuth app secrets belong in Worker secrets, never in this repo. That account-side provisioning is not yet configured.

## Publishing without code

In `/admin/`:

- **Publications:** edit the existing André Bellon article or create an article with title, author, date, category, cover image, text and optional PDF.
- **Événements:** create an event with date/time, location, category, description, image, optional PDF and external HTTPS registration link.
- **Pages du site → Accueil:** edit the homepage title and introduction.
- **Asset library:** upload images and PDFs; they are stored in `public/media/` and published at `/media/`.

New entries start as **Brouillon**. Turn it off and save/publish when ready. Drafts never get public pages or appear in lists. Future-dated articles are excluded until a build after their date (no automatic scheduled publishing yet); future events can be announced immediately. New content appears automatically in the appropriate listing and homepage section. Search/category filters run locally, without WordPress.

Article URLs use the slug (`/penser-la-situation/` is retained). Event URLs use `/evenements/<slug>/`. Keep slugs unchanged after publishing to avoid broken shared links. Duplicate/reserved article URLs fail the build. Event details display their date in UTC; the CMS stores a timezone-aware datetime.

The remaining institution, membership and contact page copy is still managed through templates. Drag-and-drop layout editing is not included. Contact remains disabled; membership/payment backends are not implemented. This migration publishes only the existing public article, not the old WordPress drafts.

## Developer commands

Requires Node 24+ (CI uses Node 24).

```bash
npm ci
npm run dev
npm test
npm run build
npm run preview
```

For a GitHub project-path preview, use `SITE_BASE=/site npm run build`. Production uses the custom domain at `/`.

## Structure

- `content/articles/*.md`: publications
- `content/events/*.md`: events
- `content/settings/home.yml`: editable homepage copy
- `src/templates/`: shared header/footer, preserved page shells
- `src/lib/site.mjs`: rendering, safe Markdown, publication visibility and search markup
- `src/content.config.ts`: validated content schemas
- `src/pages/`: Astro route generation
- `public/admin/`: Sveltia dashboard/configuration (version-pinned CDN script)
- `public/wp-content/`, `public/wp-includes/`: static legacy design assets only; no PHP/database
- `.github/workflows/deploy.yml`: automatic GitHub Pages deployment

Markdown output is sanitized before insertion. No WordPress database, private credentials or OAuth secrets are included. Content and media in this public repository are public, including draft source files: **do not put confidential material into drafts**.

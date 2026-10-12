# GitHub OAuth sign-in for ILR

This is the official [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth), vendored at commit `33674be7ec77c1b771983650d979cae88160e093` under its MIT license. One local hardening change requires HTTPS for the opener before delivering a login token. It runs on Cloudflare Workers, separately from the GitHub Pages website. No domain/DNS migration is required.

**Status: deployed and credentials configured.** Worker: `https://ilr-cms-auth.ilr-site.workers.dev`. Approved-domain HTTPS redirects and unrelated-domain rejection have been verified. CMS OAuth is enabled with token fallback; an editor must still confirm browser authorization and a content save/rebuild.

## 1. Authorize Cloudflare

From the repository root:

```bash
npx --yes wrangler@4.149.0 login
npx --yes wrangler@4.149.0 deploy --config auth/wrangler.toml
```

Use the Cloudflare account that should own this login service. Worker URL:
`https://ilr-cms-auth.<account-subdomain>.workers.dev`

An unconfigured Worker cannot complete sign-in. The Cloudflare Workers free tier should cover normal team logins; Cloudflare's current limits apply.

## 2. Register the GitHub OAuth app

Visit <https://github.com/settings/applications/new> while signed into the intended app owner account (or register it under the ILR organization).

- Application name: **Institut La Raison CMS**
- Homepage URL: `https://raison-institut.fr`
- Authorization callback URL: **the actual deployed Worker URL + `/callback`**

Generate the client secret. Store it only locally or directly in Cloudflare secrets; do not send it in chat or commit it.

## 3. Add Worker secrets

From the repository root, run these and enter values at the hidden prompt:

```bash
npx --yes wrangler@4.149.0 secret put GITHUB_CLIENT_ID --config auth/wrangler.toml
npx --yes wrangler@4.149.0 secret put GITHUB_CLIENT_SECRET --config auth/wrangler.toml
```

The allowlist is already limited to `raison-institut.fr` and `www.raison-institut.fr`. Do not widen it to `*`. Sign-in must happen on HTTPS.

## 4. Test, then activate

Before changing the live CMS, verify that the Worker `/auth?provider=github&site_id=raison-institut.fr&scope=public_repo` redirects to GitHub, rejects unrelated domains, and that the website has valid HTTPS. Then configure `public/admin/config.yml`:

```yaml
backend:
  name: github
  repo: ilr-thinktank/site
  branch: main
  base_url: https://ilr-cms-auth.ACTUAL-SUBDOMAIN.workers.dev
  auth_methods: [oauth, token] # Keep fallback until end-to-end OAuth sign-in succeeds.
  auth_scope: public_repo
```

`public_repo` is appropriate because this repository is public; it avoids the broader `repo` scope for private repositories. OAuth scopes are account-wide, not restricted to this single repo like a fine-grained token. Editors still need write access to `ilr-thinktank/site`. If the repository becomes private, adjust the scope deliberately.

After a successful browser sign-in and content save/rebuild, change `auth_methods` to `[oauth]` if token login is no longer desired. Never put the client secret into this public config.

## Maintenance

The Worker does not need redeployment for ordinary site content changes. Redeploy it explicitly after authentication-code changes. Site deployment remains the existing GitHub Pages workflow. Review upstream changes before updating the vendored code.

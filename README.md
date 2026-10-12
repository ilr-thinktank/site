# Institut La Raison

Static proof of concept reconstructed from the verified WordPress backup of `raison-institut.fr`.

## Preview locally

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>.

## Current scope

- Pixel-faithful static copy of the public website
- Responsive pages, typography, images, navigation, and animations
- No WordPress, PHP, database, or secrets in this repository
- Ready for static hosting such as Cloudflare Pages

The contact and membership forms are visual replicas only. Their submission backends and the content-management interface will be implemented separately.

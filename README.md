# Smelloff

D2C e-commerce site for **ODORSTRIKE** — pocket-sized fabric odor remover spray for clothes. Static site plus one Cloudflare Worker (`src/index.js`) at [smelloff.in](https://smelloff.in).

## Layout

| Path | What it is |
| --- | --- |
| `index.html` + root `*.html` | Site pages (homepage, policies, contact, blog index, etc.) — root files map to URLs |
| `blog/` | Blog posts |
| `assets/` | CSS, JS, fonts, images, icons |
| `api/` | API handlers mounted by the Cloudflare Worker in `src/index.js` (orders, email, tracking, admin) |
| `admin/` | Private admin dashboard SPA |
| `emails/` | Transactional email templates |
| `scripts/` | Blog build/maintenance scripts |
| `supabase/` | Database migrations |
| `docs/` | Internal docs, audits, and plans — see [docs/README.md](docs/README.md) |
| `robots.txt`, `sitemap.xml`, `llms.txt`, `manifest.json` | Site files — must stay at root |
| `wrangler.jsonc`, `config/routing.json` | Cloudflare Worker config; redirects + headers (compiled to `_redirects` / `_headers` by `npm run build`) |

See [CLAUDE.md](CLAUDE.md) for the full project context.

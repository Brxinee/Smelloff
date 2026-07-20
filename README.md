# Smelloff

D2C e-commerce site for **ODORSTRIKE** — India's first pocket-sized fabric odor remover spray. Static site deployed on Vercel at [smelloff.in](https://smelloff.in).

## Layout

| Path | What it is |
| --- | --- |
| `index.html` + root `*.html` | Site pages (homepage, policies, contact, blog index, etc.) — root files map to URLs |
| `blog/` | Blog posts |
| `assets/` | CSS, JS, fonts, images, icons |
| `api/` | Vercel serverless functions (orders, email, tracking, admin) |
| `admin/` | Private admin dashboard SPA |
| `emails/` | Transactional email templates |
| `scripts/` | Blog build/maintenance scripts |
| `supabase/` | Database migrations |
| `docs/` | Internal docs, audits, and plans — see [docs/README.md](docs/README.md) |
| `robots.txt`, `sitemap.xml`, `llms.txt`, `manifest.json`, `vercel.json` | Site/deploy configuration — must stay at root |

See [CLAUDE.md](CLAUDE.md) for the full project context.

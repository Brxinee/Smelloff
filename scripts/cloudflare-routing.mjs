/*
 * config/routing.json → Cloudflare Workers static-asset routing files.
 *
 * config/routing.json is the single source of truth for redirects, rewrites
 * and headers (it was vercel.json until the site left Vercel for good).
 * prepare-public.mjs writes public/_redirects and public/_headers from it on
 * every build — without that, every 301 for a deleted blog slug, the
 * /.well-known/llms.txt aliases and all security/cache headers disappear.
 *
 * Deliberately NOT translated (Cloudflare handles them another way):
 *   - rules with `has` (host = www.smelloff.in): _redirects cannot match on
 *     host. www → apex needs a Cloudflare Redirect Rule on the zone.
 *   - `/(.*)\.html` and `/:path+/`: wrangler.jsonc sets
 *     assets.html_handling = "drop-trailing-slash", which does both.
 *   - /api/* rewrites and headers: _headers/_redirects only apply to static
 *     assets; the Worker (src/index.js) owns /api.
 *   - Content-Type headers: the asset server already sends correct types, and
 *     duplicated headers in _headers are comma-joined, not replaced.
 *   - the catch-all extension regex for immutable caching: every such file
 *     lives under /assets/ (covered by `/assets/*`), and the regex would also
 *     match /sw.js, whose Cache-Control would then be comma-joined with its
 *     own must-revalidate rule.
 */

const STATUS_DEFAULT = 307; // temporary unless the rule says `permanent: true`.

function statusOf(rule) {
  if (rule.statusCode) return rule.statusCode;
  return rule.permanent ? 301 : STATUS_DEFAULT;
}

/** `/a/(x|y|z)` or `/:slug(x|y)` → ['/a/x', …] with the captured value. */
function expandAlternation(source) {
  const m = source.match(/^(.*?)(?::(\w+))?\(([\w.|-]+)\)$/);
  if (!m || !m[3].includes('|')) return null;
  const [, prefix, name, alts] = m;
  return alts.split('|').map((value) => ({ path: prefix + value, name, value }));
}

export function buildRedirects(routing) {
  const lines = [];
  const seen = new Set();
  const push = (from, to, status) => {
    if (seen.has(from)) return;
    seen.add(from);
    lines.push(`${from} ${to} ${status}`);
  };

  for (const rule of routing.redirects || []) {
    if (rule.has || rule.missing) continue;
    const { source, destination } = rule;
    const status = statusOf(rule);

    if (source === '/(.*)\\.html' || source === '/:path+/') continue;

    const expanded = expandAlternation(source);
    if (expanded) {
      for (const { path, name, value } of expanded) {
        push(path, name ? destination.replace(`:${name}`, value) : destination, status);
      }
      continue;
    }

    // `/prefix/:name*` (any depth) is a native splat: `/prefix/*  …/:splat`.
    const splat = source.match(/^(\/[\w.-]+)\/:(\w+)\*$/);
    if (splat) {
      push(`${splat[1]}/*`, destination.replace(`:${splat[2]}*`, ':splat'), status);
      continue;
    }

    // Plain paths and simple `:name` placeholders are native _redirects syntax.
    if (/[()*+?\\]/.test(source)) {
      throw new Error(`cloudflare-routing: cannot translate redirect source ${source}`);
    }
    push(source, destination, status);
    // Match with and without a trailing slash; _redirects is exact.
    if (!source.includes(':') && source !== '/' && !source.endsWith('/')) {
      push(source + '/', destination, status);
    }
  }

  for (const rule of routing.rewrites || []) {
    if (rule.source.startsWith('/api/')) continue;
    if (/[():*]/.test(rule.source)) {
      throw new Error(`cloudflare-routing: cannot translate rewrite source ${rule.source}`);
    }
    push(rule.source, rule.destination, 200);
  }

  // Every line after the first placeholder/splat rule counts toward
  // Cloudflare's 100-dynamic-rule cap, so static rules must come first.
  const isDynamic = (line) => /[:*]/.test(line.split(' ')[0]);
  return [...lines.filter((l) => !isDynamic(l)), ...lines.filter(isDynamic)].join('\n') + '\n';
}

export function buildHeaders(routing) {
  const blocks = [];
  for (const rule of routing.headers || []) {
    const { source } = rule;
    if (source.startsWith('/api/')) continue;
    if (source === '/(.*\\.html)') continue; // clean URLs never end in .html
    if (/^\/\(\.\*\\\.\(\?:/.test(source)) continue; // extension catch-all, see above

    let paths;
    if (source === '/(.*)') paths = ['/*'];
    else if (/^\/[\w./-]*\/\(\.\*\)$/.test(source)) paths = [source.replace('(.*)', '*')];
    else if (expandAlternation(source)) paths = expandAlternation(source).map((e) => e.path);
    else if (/^\/[\w./-]*$/.test(source)) paths = [source];
    else throw new Error(`cloudflare-routing: cannot translate header source ${source}`);

    const headers = rule.headers.filter((h) => h.key.toLowerCase() !== 'content-type');
    if (!headers.length) continue;
    for (const path of paths) {
      blocks.push([path, ...headers.map((h) => `  ${h.key}: ${h.value}`)].join('\n'));
    }
  }
  return blocks.join('\n') + '\n';
}

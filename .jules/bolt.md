## 2024-05-24 - Unnecessary fetch in Service Worker
**Learning:** Returning `cached || network` in a `.then(cached => ...)` block executes both paths if `network` is initiated beforehand. The current `sw.js` accidentally implements stale-while-revalidate for immutable static assets by calling `fetch(req)` before checking `if (cached) return cached`.
**Action:** Always return early (`if (cached) return cached;`) in cache-first strategies before initializing a network request to prevent redundant background fetches.

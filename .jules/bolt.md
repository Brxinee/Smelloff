## 2024-09-18 - Avoid stale-while-revalidate for immutable assets in Service Workers
**Learning:** Using a stale-while-revalidate pattern (where a network fetch is always initiated even if a cache hit occurs) for static and hash-versioned immutable assets wastes bandwidth and causes redundant background requests, hurting battery life and performance unnecessarily.
**Action:** Implement a true cache-first strategy with an early return (`if (cached) return cached;`) for static assets in `sw.js` to ensure the network is only queried when the asset is completely missing from the cache.

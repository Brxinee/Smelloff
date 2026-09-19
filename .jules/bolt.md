## 2025-02-27 - True cache-first strategy with early return for static assets
**Learning:** Service worker cache strategies that fetch in the background to update the cache (stale-while-revalidate) for immutable static assets create redundant network overhead on every request. This wastes bandwidth and battery, going against the goal of caching for performance.
**Action:** When implementing cache-first strategies for immutable static assets in the service worker, always include an early return (`if (cached) return cached;`) to prevent background fetching.

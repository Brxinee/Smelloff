## 2026-09-22 - True Cache-First Strategy for Immutable Assets
**Learning:** Returning `cached || network` in a service worker fetch handler initiates a redundant background network request even if `cached` is truthy, wasting bandwidth and main thread cycles on immutable assets.
**Action:** Implement an explicit early return (`if (cached) return cached;`) for static and immutable assets to ensure a true cache-first strategy.

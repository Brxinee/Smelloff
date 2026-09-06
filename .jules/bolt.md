## 2024-05-24 - Initial Bolt Journal Entry\n**Learning:** Bolt journal must exist for critical learnings.\n**Action:** Created the journal as requested.
## 2024-05-24 - Missing requestAnimationFrame lock in scroll handlers
**Learning:** Found a high-frequency `scroll` event listener in `initReviewDots` firing `requestAnimationFrame` without a lock. While `rAF` defers execution, doing this without a flag enqueues multiple duplicate callbacks per frame on fast scrolls, which can cause jank and redundant layout recalculations (DOM thrashing).
**Action:** Always wrap `requestAnimationFrame` inside a `if (!ticking)` flag block for `scroll` or `mousemove` events to ensure only one callback runs per frame.

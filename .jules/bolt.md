## 2024-05-17 - Scroll Event Layout Thrashing
**Learning:** Attaching a `scroll` event listener that reads layout properties (`scrollLeft`, `clientWidth`) and writes to the DOM (`classList.toggle`) without throttling forces synchronous layout recalculations (thrashing) multiple times per frame.
**Action:** Always throttle high-frequency events like `scroll` or `resize` with `requestAnimationFrame` and a `ticking` flag to batch DOM reads and writes into a single frame execution.

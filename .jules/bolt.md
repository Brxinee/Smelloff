## 2024-09-08 - Throttle requestAnimationFrame in scroll listeners
**Learning:** Directly calling `requestAnimationFrame` inside a highly frequent event listener (like `scroll`) without a throttling flag (e.g., `ticking = false`) can queue up multiple executions per frame. If the callback performs DOM reads (like `scrollLeft` or `offsetLeft`), this causes redundant CPU work and can lead to layout thrashing.
**Action:** Always use a boolean flag to ensure only one `requestAnimationFrame` callback is queued per frame inside high-frequency listeners (scroll, resize, etc.).

## 2025-02-06 - Avoid Scroll Listeners with IntersectionObserver
**Learning:** Attaching a `scroll` event listener with `requestAnimationFrame` when an `IntersectionObserver` is already actively observing the same elements creates unnecessary main thread wakeups on every scroll event, even if the work inside the scroll listener is trivial or gated.
**Action:** Always conditionally bypass `addEventListener('scroll', ...)` entirely if `IntersectionObserver` is supported and used, rather than relying on internal feature-detection gates within the listener callback.

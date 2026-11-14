## 2026-10-27 - Prevent Layout Thrashing in Auto-Expanding Textareas
**Learning:** To prevent layout thrashing in auto-expanding textareas, avoid writing `element.style.height = 'auto'` followed immediately by reading `element.scrollHeight` unconditionally on every keystroke. This pattern forces synchronous layout recalculation.
**Action:** Conditionally execute the resize logic when text is replaced/deleted (e.g., new value does not start with the previous value) or when it overflows the current height, rather than relying solely on text length.

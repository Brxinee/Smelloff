## 2025-01-31 - Avoid Layout Thrashing in Auto-expanding Textareas
**Learning:** Writing `element.style.height = "auto"` followed immediately by reading `element.scrollHeight` unconditionally on every keystroke causes severe layout thrashing (synchronous DOM forced layouts), degrading input performance especially on lower-end devices.
**Action:** Conditionally execute the resize logic only when the text length shrinks or overflows its current height.

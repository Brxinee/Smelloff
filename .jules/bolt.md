## 2024-11-20 - Prevent Layout Thrashing in Auto-expanding Textareas
**Learning:** Interleaving DOM reads (`element.scrollHeight`) and writes (`element.style.height`) on every keystroke unconditionally causes layout thrashing, even if the value hasn't visually changed the height.
**Action:** Conditionally execute the resize logic. Only recalculate and apply the height if the text changes significantly (e.g., deleted text) or actually overflows the current height.

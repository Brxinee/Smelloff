## 2024-09-06 - Missing accessibility attributes for toggling elements

**Learning:** Interactive elements that expand/collapse content should have `aria-expanded` and `aria-controls` attributes, enabling screen readers to announce the current state (expanded/collapsed) and link to the controlled element. Additionally, icon-only buttons (like image zoom buttons) need `aria-label`s.

**Action:** Added `aria-expanded` and `aria-controls` to the formula toggle button, dynamically updating `aria-expanded` on click. Also added `aria-label` to all gallery zoom buttons in the product page.

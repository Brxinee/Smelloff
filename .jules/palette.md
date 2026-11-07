## 2026-10-22 - Screen Reader Announcements for Async Forms
**Learning:** Modifying button text and disabled states is insufficient for assistive technologies to correctly announce loading states during async fetch operations.
**Action:** Dynamically add and remove `aria-busy="true"` on submit buttons when fetch operations start and complete.

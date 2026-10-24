## 2024-10-24 - Accessibility for async forms
**Learning:** Changing button text and disabled states during async actions is insufficient for screen readers. Forms need dynamic `aria-busy` announcements.
**Action:** Always dynamically add and remove `aria-busy="true"` on submit buttons during fetch operations to ensure reliable screen reader announcements for the loading state.

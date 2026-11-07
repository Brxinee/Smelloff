## 2024-10-28 - Async Form Screen Reader Announcements
**Learning:** For async forms, relying solely on changing button text and disabled states is insufficient for assistive technologies. We need to dynamically add and remove `aria-busy="true"` on the submit button during fetch operations to ensure reliable screen reader announcements for the loading state.
**Action:** Add `aria-busy="true"` to form submit buttons when a fetch starts, and remove it (or set to "false") when it completes or errors out.

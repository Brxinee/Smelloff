## 2026-10-21 - Dynamic aria-busy on Async Forms
**Learning:** Found that merely changing button text (e.g. to 'Checking...') and using the disabled state during an async fetch might not reliably announce the ongoing process to all screen readers.
**Action:** Implemented `aria-busy="true"` dynamically on the submit button (`#trackBtn`) immediately when the fetch begins, and removed it when the promise settles, to ensure assistive technologies correctly announce the loading state on this component. This is a reusable pattern for other async forms in the design system.

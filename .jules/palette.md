## 2024-11-20 - Aria-busy for form submissions
**Learning:** Changing button text and relying on `disabled` states is insufficient for assistive technologies like screen readers to interpret loading states. Adding `aria-busy="true"` explicitly communicates this loading state reliably.
**Action:** Always dynamically toggle the `aria-busy` attribute when modifying form submission loading states.

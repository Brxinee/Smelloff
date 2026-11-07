## 2024-10-24 - Timing attack via early return in session validation
**Vulnerability:** `verifySession` in `api/admin.js` returned early if buffer lengths did not match, exposing a timing attack to determine MAC lengths, and could potentially crash on timingSafeEqual if buffers were different lengths.
**Learning:** `crypto.timingSafeEqual` in Node.js throws if buffer lengths differ. Using an early return before it, or short-circuiting logical operators (`||`), introduces observable timing differences that leak information.
**Prevention:** Always ensure constant-time execution paths by using a boolean flag instead of early returns and performing dummy comparisons (e.g., `crypto.timingSafeEqual(expectedBuf, expectedBuf)`) when lengths differ.

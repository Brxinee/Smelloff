## 2026-10-20 - Fix Timing Attack in Session Verification
**Vulnerability:** A timing side-channel vulnerability in `api/admin.js` where `mac.length !== expected.length` exited early, allowing attackers to potentially guess the required MAC length and signature byte-by-byte.
**Learning:** `crypto.timingSafeEqual` strictly requires buffers of the exact same size and throws an exception otherwise. Therefore, string comparisons or lengths checks before comparing buffers can leak timing information if they return early.
**Prevention:** Perform a dummy comparison (e.g., `crypto.timingSafeEqual(expectedBuf, expectedBuf)`) and securely store the validity state `isValid = false` when lengths differ, avoiding early returns to maintain constant-time execution.

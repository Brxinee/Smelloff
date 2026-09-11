## 2025-02-27 - TimingSafeEqual Vulnerability pattern
**Vulnerability:** Use of `crypto.timingSafeEqual` with unequal length buffers throws an error, causing signature verification functions to throw rather than return `false`, which can leak info or cause DoS via unhandled exceptions in older Node.js versions, although here it is caught in a try/catch block.
**Learning:** `crypto.timingSafeEqual` throws when buffer lengths are different.
**Prevention:** Check that buffer lengths match before calling `crypto.timingSafeEqual`.
## 2025-02-27 - crypto.timingSafeEqual length early exit timing leak
**Vulnerability:** The code `a.length === b.length && crypto.timingSafeEqual(a, b)` prevents `timingSafeEqual` from throwing when buffer lengths mismatch. However, the short-circuit evaluation (`&&`) means `timingSafeEqual` is bypassed entirely when lengths differ. This creates an early return, leaking the expected buffer length via timing side-channels, which is especially critical for secret keys or passwords where the length is unknown to an attacker.
**Learning:** `crypto.timingSafeEqual` throws when buffer lengths are different, but protecting it with a short-circuit length check creates a timing attack vulnerability that leaks the length.
**Prevention:** When verifying tokens or secrets of variable/unknown length, always execute a dummy constant-time comparison (e.g., `crypto.timingSafeEqual(a, a)`) before returning false on length mismatch to ensure execution time remains constant regardless of input length.

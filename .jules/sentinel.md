## 2024-10-18 - Fixed Early Returns in Constant-Time Comparisons
**Vulnerability:** Timing attacks due to early returns inside `crypto.timingSafeEqual` blocks. The code was returning early if the buffers were not of equal length, exposing a timing difference.
**Learning:** Checking buffer lengths and returning early defeats the purpose of `crypto.timingSafeEqual`, as it creates a measurable timing difference between valid and invalid inputs.
**Prevention:** To prevent timing side-channels, perform a dummy comparison `crypto.timingSafeEqual(expected, expected)` if lengths differ, and use a boolean flag (e.g., `let isValid = false`) to ensure the entire execution block always takes an identical amount of time, regardless of the comparison's outcome. Do not return early.

## 2024-10-18 - Fixed Unhandled TypeError in Constant-Time Comparisons
**Vulnerability:** A DoS vulnerability where mismatched string comparisons using `.length` lead to a `TypeError` if unicode strings with identical character counts but different byte lengths are passed to `crypto.timingSafeEqual`.
**Learning:** Comparing string length is not equivalent to comparing buffer byte length. If strings are passed, `crypto.timingSafeEqual` will throw an unhandled `TypeError` if their byte lengths differ, leading to potential Denial of Service (DoS).
**Prevention:** Convert strings to `Buffer` before comparing their lengths (`macBuf.length !== expectedBuf.length`), and wrap the comparison in a try-catch block to handle errors safely without early returns or unhandled exceptions.

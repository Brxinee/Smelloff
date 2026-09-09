## 2026-09-09 - Path Traversal in Custom Static File Handler
**Vulnerability:** The express `server.js` was doing `path.join(__dirname, urlPath)` without checking if the resulting `filePath` was still contained within `__dirname`.
**Learning:** `path.join` resolves `..` in paths, meaning an attacker passing `/../../etc/passwd` would end up traversing outside the static folder if not explicitly prevented, leading to local file inclusion (LFI) / path traversal.
**Prevention:** Always check if the resolved static file path begins with the base directory (e.g., `!filePath.startsWith(__dirname + path.sep) && filePath !== __dirname`) before serving the file, or use a battle-tested static handler like `express.static()` which has built-in directory traversal protection.

// Cloudflare-safe compatibility entrypoint.
// Runtime code should import ./products-config-workers.js directly.
// Keeping this wrapper safe also prevents legacy imports from reaching
// Node filesystem APIs inside the Workers bundle.
export * from './products-config-workers.js';

// Run work after the response is sent. On Cloudflare Workers, waitUntil()
// from cloudflare:workers keeps the request alive until the promise settles,
// so the customer doesn't wait for it. Anywhere else (Node tests, local
// dev) the module doesn't exist and the work is simply awaited.
let resolved;

async function getWaitUntil() {
  if (resolved !== undefined) return resolved;
  try {
    const mod = await import('cloudflare:workers');
    resolved = typeof mod.waitUntil === 'function' ? mod.waitUntil : null;
  } catch {
    resolved = null;
  }
  return resolved;
}

export async function runAfterResponse(label, task) {
  const promise = Promise.resolve()
    .then(task)
    .catch((err) => console.error(`[${label}] background task failed:`, err?.message || err));
  const waitUntil = await getWaitUntil();
  if (waitUntil) {
    waitUntil(promise);
    return;
  }
  await promise;
}

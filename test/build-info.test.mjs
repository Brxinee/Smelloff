import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// /api/health reports the commit that is live, so a deploy can be checked
// against main (2026-10-11: the live Worker kept serving pre-merge code).
test('health reports the build commit, stamped during npm run build', async () => {
  const index = readFileSync('src/index.js', 'utf8');
  assert.match(index, /import \{ BUILD \} from "\.\/build-info\.js"/);
  assert.match(index, /build: BUILD/);
  const build = JSON.parse(readFileSync('package.json', 'utf8')).scripts.build;
  assert.ok(build.includes('write-build-info.mjs'), 'build must stamp the commit');
  assert.ok(build.indexOf('write-build-info.mjs') < build.indexOf('prepare-public.mjs'), 'stamp before the bundle is prepared');
  const { BUILD } = await import('../src/build-info.js');
  assert.equal(typeof BUILD.commit, 'string');
});

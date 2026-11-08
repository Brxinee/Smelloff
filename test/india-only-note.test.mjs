// India only (2026-11-08): ODORSTRIKE ships within India. chrome.js un-hides
// "We deliver within India only." (.pd-intl on /odorstrike, .pcard__intl in
// the guides' product card) on devices whose time zone isn't India's. The
// markup ships hidden, so Indian visitors and crawlers see no change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const chromeJs = readFileSync(new URL('../assets/js/chrome.js', import.meta.url), 'utf8');
const block = chromeJs.slice(chromeJs.indexOf('// India only:'), chromeJs.indexOf("var burger = document.querySelector('.sf-burger');"));

function run(timeZone) {
  const notes = [{ hidden: true }, { hidden: true }];
  const attrs = {};
  const sandbox = {
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone }) }) },
    document: {
      documentElement: { setAttribute: (k, v) => { attrs[k] = v; } },
      querySelectorAll: (sel) => {
        assert.equal(sel, '.pd-intl, .pcard__intl');
        return notes;
      },
    },
  };
  vm.runInNewContext(block, sandbox);
  return { notes, attrs };
}

test('the India-only note stays hidden on India time and shows elsewhere', () => {
  assert.ok(block.length > 100, 'India-only block found in chrome.js');
  for (const tz of ['Asia/Kolkata', 'Asia/Calcutta']) {
    const { notes, attrs } = run(tz);
    assert.ok(notes.every((n) => n.hidden), `${tz}: hidden`);
    assert.ok(!('data-sf-abroad' in attrs));
  }
  for (const tz of ['America/New_York', 'Europe/London', 'Asia/Dubai']) {
    const { notes, attrs } = run(tz);
    assert.ok(notes.every((n) => !n.hidden), `${tz}: shown`);
    assert.ok('data-sf-abroad' in attrs);
  }
  // No time zone reported: leave the page as written.
  assert.ok(run('').notes.every((n) => n.hidden));
});

test('the notes ship hidden on the product page and in the guides', () => {
  const pdp = readFileSync(new URL('../odorstrike.html', import.meta.url), 'utf8');
  assert.match(pdp, /<p class="pd-intl" hidden>We deliver within India only\.<\/p>/);
  const post = readFileSync(new URL('../blog/remove-cooking-smell-from-clothes.html', import.meta.url), 'utf8');
  assert.match(post, /<p class="pcard__intl" hidden>We deliver within India only\.<\/p>/);
});

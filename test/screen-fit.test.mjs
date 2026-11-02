// Screen fit (2026-11-02, owner: "fit the screen properly, any screen").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the chat panel grows with the screen and never runs past it', () => {
  const js = fs.readFileSync('assets/js/support-chat.js', 'utf8');
  // Phones: full screen.
  assert.match(js, /\.sfc-panel\{position:fixed;[^}]*inset:0;height:100%;height:100dvh\}/);
  // Tablets and up: sized from the viewport, capped, and never taller/wider than it.
  const card = js.match(/@media\(min-width:520px\)\{\.sfc-panel\{[^}]*\}/)?.[0] || '';
  assert.match(card, /width:min\(calc\(100vw - 32px\),max\(420px,30vw\),520px\)/);
  assert.match(card, /height:min\(calc\(100dvh - 32px\),max\(660px,80dvh\),900px\)/);
  assert.ok(!/width:400px/.test(card), 'no fixed 400px card');
  // The big-screen type step comes after the base rules, so it wins.
  const big = js.indexOf('@media(min-width:1440px) and (min-height:820px)');
  assert.ok(big > js.indexOf("'.sfc-msg{") && big > js.indexOf("'.sfc-tile{"), 'big-screen block must come last');
});

test('large screens widen the shared column; nothing changes under 1600px', () => {
  const css = fs.readFileSync('assets/css/chrome.css', 'utf8');
  assert.match(css, /@media \(min-width:1600px\)\{\s*:root\{--maxw:1320px;/);
  assert.match(css, /@media \(min-width:2000px\)\{\s*:root\{--maxw:1480px;/);
  // Page zoom scales 100vh too (drawers and the chat panel ran off screen).
  assert.ok(!/^\s*[^/*]*\bzoom\s*:/m.test(css), 'no CSS zoom on the site');
  const tokens = fs.readFileSync('assets/css/tokens.css', 'utf8');
  assert.match(tokens, /--maxw:1160px;/, 'the default column is unchanged');
});

test('homepage hero: "Fix it." stays on one line and the sideways size tag is off on phones', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /\.hero-title \.acid\{color:var\(--acid\);white-space:nowrap\}/);
  const phone = html.slice(html.indexOf('@media(max-width:959px){\n    #sf-main .hero-visual-wrap{display:contents}'));
  assert.match(phone.slice(0, 600), /#sf-main \.hero-visual figcaption\{display:none\}/);
});

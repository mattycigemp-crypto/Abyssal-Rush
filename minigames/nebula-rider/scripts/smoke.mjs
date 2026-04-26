// Smoke test: verifies that index.html references every DOM id that the game
// code actually queries at runtime. Catches broken wiring (e.g., a settings
// control declared in JS but forgotten in HTML).
//
// This runs in plain Node with no browser, so it can't actually execute
// Three.js code — but that's fine. Runtime errors are caught by CI's browser
// smoke which is invoked separately when a preview is available.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (extname(entry) === '.js') out.push(full);
  }
  return out;
}

const html = readFileSync('index.html', 'utf8');
const idRe = /id=["']([a-zA-Z0-9_-]+)["']/g;
const htmlIds = new Set();
for (const m of html.matchAll(idRe)) htmlIds.add(m[1]);

const getByIdRe = /document\.getElementById\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g;
const referenced = new Set();
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(getByIdRe)) referenced.add(m[1]);
}

const missing = [...referenced].filter((id) => !htmlIds.has(id));
if (missing.length) {
  console.error('smoke: DOM ids referenced in JS but missing from index.html:\n  ' + missing.join('\n  '));
  process.exit(1);
}
// Make sure critical overlays and the canvas exist.
const required = ['game', 'hud', 'start-screen', 'pause-screen', 'gameover-screen', 'settings-screen', 'loading'];
const stillMissing = required.filter((id) => !htmlIds.has(id));
if (stillMissing.length) {
  console.error('smoke: required ids missing from index.html:\n  ' + stillMissing.join('\n  '));
  process.exit(1);
}

console.log(`smoke: OK (${htmlIds.size} HTML ids; ${referenced.size} JS refs; 0 missing)`);

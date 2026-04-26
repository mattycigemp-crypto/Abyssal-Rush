// Minimal syntax check: parses every .js/.mjs file in src/ and scripts/ as an
// ES module. Used as a CI lint step — keeps the repo dependency-free while
// still catching typos and unclosed braces.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (extname(entry) === '.js' || extname(entry) === '.mjs') out.push(full);
  }
  return out;
}

const roots = ['src', 'scripts'];
let failed = 0;
for (const r of roots) {
  let files;
  try { files = walk(r); } catch { continue; }
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // Parse as an ES module via `node --check` with stdin, so `import` syntax
    // is understood even in `.js` files.
    const res = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: src, encoding: 'utf8' });
    if (res.status !== 0) {
      failed++;
      console.error(`FAIL ${f}\n${res.stderr || res.stdout}`);
    } else {
      console.log(`ok  ${f}`);
    }
  }
}
if (failed) {
  console.error(`\n${failed} file(s) failed syntax check.`);
  process.exit(1);
}
console.log('\nAll files pass syntax check.');

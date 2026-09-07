// Verifies docs/APPSTORE.md against App Store Connect's field limits. Apple rejects an over-length
// field at paste time, which is a slow way to find out. Run: node scripts/check-listing.js
'use strict';
const fs = require('fs');
const path = require('path');

const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'APPSTORE.md'), 'utf8');

/** Pull the first fenced block that follows a heading containing `needle`. */
function block(needle) {
  const i = md.indexOf(needle);
  if (i < 0) return null;
  const open = md.indexOf('```', i);
  if (open < 0) return null;
  const start = md.indexOf('\n', open) + 1;
  const end = md.indexOf('```', start);
  return end < 0 ? null : md.slice(start, end).replace(/\n$/, '');
}

// Apple counts characters, not bytes; a name of up to 12 chars keeps the reserved room below.
const NAME_BUDGET = 12;
const checks = [
  { label: 'Subtitle', needle: '## Subtitle', limit: 30 },
  { label: 'Promotional text', needle: '## Promotional text', limit: 170 },
  { label: 'Description', needle: '## Description', limit: 4000 },
  { label: 'Keywords', needle: '## Keywords', limit: 100 },
  { label: 'App Review notes', needle: '## App Review notes', limit: 4000 },
  { label: "What's New", needle: "## What's New", limit: 4000 },
];

let bad = 0;
for (const c of checks) {
  const text = block(c.needle);
  if (text === null) { console.log(`MISSING  ${c.label}`); bad++; continue; }
  const n = text.length;
  const ok = n <= c.limit;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'OVER'}  ${c.label.padEnd(18)} ${String(n).padStart(5)} / ${c.limit}`);
  if (c.label === 'Keywords') {
    if (/\s/.test(text)) { console.log('OVER  Keywords contain whitespace — spaces count against the 100'); bad++; }
    const dupes = text.split(',').filter((w, i, a) => a.indexOf(w) !== i);
    if (dupes.length) { console.log('OVER  Duplicate keywords: ' + dupes.join(', ')); bad++; }
  }
}
console.log(`\nApp name budget assumed by these counts: <= ${NAME_BUDGET} characters (limit is 30).`);
process.exit(bad ? 1 : 0);

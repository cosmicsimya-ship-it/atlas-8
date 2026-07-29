/**
 * Secret audit for tracked files only. Never prints secret values.
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);

const patterns = [
  { name: 'placeholder_founder_password', re: /BURAYA_EN_AZ_12_KARAKTERLIK_GUCLU_SIFRE/ },
  { name: 'old_bot_secret_fragment', re: /YYTqQPB2qvoMgXf36NmrM8giFmKJfPleqAObJaE49vQ/ },
];

const hits = [];
for (const file of tracked) {
  if (file.startsWith('node_modules/') || file.endsWith('.map')) continue;
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const p of patterns) {
    if (p.re.test(text)) {
      hits.push({ file, pattern: p.name });
    }
  }
  // Flag only non-test hardcoded env secret literals in tracked source.
  for (const m of text.matchAll(/ATLAS_(?:FOUNDER_PASSWORD|INTERNAL_BOT_SECRET)\s*=\s*['"]([^'"]+)['"]/g)) {
    const val = m[1] || '';
    if (/^test[-_]/i.test(val) || val.includes('at-least-')) continue;
    hits.push({ file, pattern: 'hardcoded_env_secret_literal' });
  }
}

if (hits.length) {
  console.log(JSON.stringify({ ok: false, hits }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, trackedFilesScanned: tracked.length, hits: 0 }));

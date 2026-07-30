/**
 * Read-only Git history secret audit. Never prints full secret values.
 * Uses execFileSync so Windows cmd does not expand %format% placeholders.
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  }).trim();
}

function mask(value, kind) {
  const v = String(value || '').trim();
  if (!v) return '(empty)';
  if (kind === 'openai' || v.startsWith('sk-')) {
    return `sk-...${v.slice(-4)}`;
  }
  if (kind === 'telegram' || /^\d+:[A-Za-z0-9_-]{20,}$/.test(v)) {
    const head = v.split(':')[0] || '????';
    return `${head}:...${v.slice(-4)}`;
  }
  if (v.length <= 8) return `${v[0] || '*'}…`;
  return `${v.slice(0, 4)}...${v.slice(-4)}`;
}

function classifyKey(key, value) {
  const k = key.toUpperCase();
  const v = String(value || '');
  if (/OPENAI/.test(k) || v.startsWith('sk-')) return 'OPENAI_API_KEY';
  if (/TELEGRAM.*TOKEN|BOT_TOKEN/.test(k) || /^\d+:[A-Za-z0-9_-]{20,}$/.test(v)) return 'TELEGRAM_BOT_TOKEN';
  if (/INTERNAL_BOT_SECRET/.test(k)) return 'ATLAS_INTERNAL_BOT_SECRET';
  if (/FOUNDER_PASSWORD/.test(k)) return 'ATLAS_FOUNDER_PASSWORD';
  if (/SESSION_SECRET|JWT_SECRET/.test(k)) return 'SESSION_OR_JWT_SECRET';
  if (/DATABASE_URL|MONGO|POSTGRES|REDIS_URL/.test(k)) return 'DATABASE_URL';
  if (/CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|API_KEY|PASSWORD|SECRET|TOKEN/.test(k)) {
    return k;
  }
  return null;
}

function parseEnv(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    const kind = classifyKey(key, val);
    if (!kind) continue;
    if (/^(changeme|your_|xxx|todo|placeholder|BURAYA_|<.*>|\[.*\])/i.test(val)) continue;
    if (val.length < 8 && !val.startsWith('sk-')) continue;
    out.push({ key, kind, value: val });
  }
  return out;
}

const root = process.cwd();
const currentEnv = existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8') : '';
const currentParsed = parseEnv(currentEnv);
const currentByKind = new Map();
for (const s of currentParsed) currentByKind.set(s.kind, s.value);

const envCommits = git([
  'log',
  '--all',
  '--pretty=format:%H',
  '--',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.atlas-local-founder-credentials.txt',
])
  .split(/\r?\n/)
  .filter(Boolean);

const findings = [];
const seen = new Set();
const paths = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.atlas-local-founder-credentials.txt',
];

for (const commit of envCommits) {
  let date = '';
  let subject = '';
  try {
    date = git(['show', '-s', '--format=%ci', commit]);
    subject = git(['show', '-s', '--format=%s', commit]).slice(0, 80);
  } catch {
    continue;
  }

  for (const path of paths) {
    let blob = '';
    try {
      blob = git(['show', `${commit}:${path}`]);
    } catch {
      continue;
    }

    if (path.includes('credentials') && /password/i.test(blob)) {
      findings.push({
        path,
        commit: commit.slice(0, 7),
        date,
        subject,
        type: 'LOCAL_CREDENTIAL_FILE',
        masked: '(credential recovery file present)',
        likelyStillValid: false,
        presentInCurrentWorkingEnv: false,
      });
    }

    for (const s of parseEnv(blob)) {
      const masked = mask(
        s.value,
        s.kind === 'OPENAI_API_KEY'
          ? 'openai'
          : s.kind === 'TELEGRAM_BOT_TOKEN'
            ? 'telegram'
            : 'generic',
      );
      const id = `${path}|${commit}|${s.kind}|${masked}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const currentVal = currentByKind.get(s.kind);
      const matchesCurrent = Boolean(currentVal && currentVal === s.value);
      findings.push({
        path,
        commit: commit.slice(0, 7),
        date,
        subject,
        type: s.kind,
        key: s.key,
        masked,
        likelyStillValid: matchesCurrent ? true : 'unknown_if_rotated_at_provider',
        presentInCurrentWorkingEnv: matchesCurrent,
      });
    }
  }
}

const touchedRaw = git(['log', '--all', '--pretty=format:%h|%ci|%s', '--', '.env']);
const touched = touchedRaw
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [h, d, ...rest] = line.split('|');
    return { commit: h, date: d, subject: rest.join('|').slice(0, 80) };
  });

let trackedNow = [];
try {
  const t = git([
    'ls-files',
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    '.atlas-local-founder-credentials.txt',
  ]);
  trackedNow = t ? t.split(/\r?\n/).filter(Boolean) : [];
} catch {
  trackedNow = [];
}

const byType = {};
for (const f of findings) {
  byType[f.type] = byType[f.type] || new Set();
  byType[f.type].add(f.masked);
}
const summaryTypes = Object.fromEntries(
  Object.entries(byType).map(([k, set]) => [k, [...set]]),
);

const patternHits = [];
const patterns = [
  { name: 'openai_sk', re: /sk-[A-Za-z0-9_\-]{10,}/g, kind: 'openai' },
  { name: 'telegram_bot_token', re: /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/g, kind: 'telegram' },
  { name: 'private_key_block', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, kind: 'generic' },
];

for (const commit of envCommits) {
  let blob = '';
  try {
    blob = git(['show', `${commit}:.env`]);
  } catch {
    continue;
  }
  for (const p of patterns) {
    const matches = blob.match(p.re) || [];
    for (const m of matches) {
      const masked = mask(m, p.kind);
      const id = `${p.name}|${masked}|${commit.slice(0, 7)}`;
      if (seen.has(`pat:${id}`)) continue;
      seen.add(`pat:${id}`);
      patternHits.push({ path: '.env', commit: commit.slice(0, 7), type: p.name, masked });
    }
  }
}

const affectedCommits = [...new Set(findings.map((f) => f.commit))];

console.log(
  JSON.stringify(
    {
      ok: true,
      commitsTouchingEnv: touched,
      trackedSecretPathsNow: trackedNow,
      findingCount: findings.length,
      affectedCommitCount: affectedCommits.length,
      affectedCommits,
      findings,
      maskedSummaryByType: summaryTypes,
      patternHits,
      currentEnvKindsPresent: [...currentByKind.keys()],
      notes: [
        'Full secret values intentionally omitted.',
        'likelyStillValid=true only when historical value equals current local .env value.',
      ],
    },
    null,
    2,
  ),
);

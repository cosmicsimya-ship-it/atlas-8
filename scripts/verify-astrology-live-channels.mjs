/**
 * Live channel verify: Telegram + Web against production backend :3001
 * Run: node scripts/verify-astrology-live-channels.mjs
 */
import 'dotenv/config';
import { execSync } from 'child_process';

const BACKEND = (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

function getPortPid(port) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -First 1).OwningProcess"`,
      { encoding: 'utf8', windowsHide: true },
    );
    const n = parseInt(out.trim(), 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function listAtlasBackends() {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -match 'server[/\\\\]index\\.js' } | ForEach-Object { $_.ProcessId }"`,
      { encoding: 'utf8', windowsHide: true },
    );
    return out
      .split(/\r?\n/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
  } catch {
    return [];
  }
}

async function hit(path, body) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  return { httpStatus: res.status, ...j };
}

function summarize(label, channel, j, portPid) {
  const d = j.data || {};
  return {
    label,
    channel,
    backendUrl: BACKEND,
    backendPort: 3001,
    backendPid: portPid,
    httpStatus: j.httpStatus,
    status: j.status,
    engine: j.engine,
    intent: d.conversationIntent || d.astrologyIntent || j.intent,
    responseMode: d.styleDebug?.selectedResponseMode ?? null,
    astrologyMetadata: d.astrologyMetadata ?? null,
    reply: j.reply,
    wordCount: String(j.reply || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length,
  };
}

const portPid = getPortPid(3001);
const backends = listAtlasBackends();
const health = await fetch(`${BACKEND}/api/ai/health`)
  .then((r) => r.json())
  .catch((e) => ({ error: e.message }));

console.log(
  JSON.stringify(
    {
      inventory: {
        backendUrl: BACKEND,
        port3001Pid: portPid,
        allIndexJsPids: backends,
        singleBackend: backends.length === 1 && backends[0] === portPid,
        health,
        telegramTarget: process.env.BACKEND_URL || 'http://localhost:3001 (default)',
        webTarget: 'http://localhost:3001 (src/config.ts / atlas-chat.ts)',
      },
    },
    null,
    2,
  ),
);

const cases = [
  'Bugünün astrolojik analizini yap.',
  'Genel gökyüzü olsun; Hicri ve numerolojik etkileri de ekle.',
  'Benim doğum haritama etkisini incele.',
  'İlişkime etkisini incele.',
];

const historyTg = [];
const historyWeb = [];
const report = [];

for (let i = 0; i < cases.length; i++) {
  const msg = cases[i];
  const id = i + 1;

  const tg = await hit('/api/atlas/message', {
    channel: 'telegram',
    userId: 'telegram:7142880605',
    conversationId: 'verify-tg-astro',
    message: msg,
    history: [...historyTg],
    metadata: { telegramFromId: '7142880605' },
  });
  historyTg.push({ role: 'user', content: msg });
  historyTg.push({ role: 'assistant', content: tg.reply || '' });
  report.push(summarize(`TG-${id}`, 'telegram', tg, portPid));

  const web = await hit('/api/chat', {
    channel: 'web',
    userId: 'web:lara-web-session',
    conversationId: 'web:lara-web-session',
    message: msg,
    history: [...historyWeb],
    metadata: { sessionId: 'lara-web-session' },
  });
  historyWeb.push({ role: 'user', content: msg });
  historyWeb.push({ role: 'assistant', content: web.reply || '' });
  report.push(summarize(`WEB-${id}`, 'web', web, portPid));
}

console.log(JSON.stringify({ results: report }, null, 2));

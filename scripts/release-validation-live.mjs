/**
 * Live release validation against a running backend (default :3001).
 * Evidence-based checks for auth, chat, memory safety, symbolic, security.
 *
 * Usage: node scripts/release-validation-live.mjs
 */
const base = process.env.ATLAS_BACKEND_URL || 'http://127.0.0.1:3001';
const jar = {};

function parseSetCookie(res) {
  const headers = res.headers.getSetCookie?.() || [];
  for (const c of headers) {
    const [kv] = c.split(';');
    const i = kv.indexOf('=');
    if (i > 0) jar[kv.slice(0, i)] = kv.slice(i + 1);
  }
}

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

const results = [];

function ok(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'non-json', raw: text.slice(0, 200) };
  }
}

async function chat(csrf, message, history = []) {
  const r = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      'X-Atlas-Csrf': csrf,
      Cookie: cookieHeader(),
    },
    body: JSON.stringify({ message, history }),
  });
  parseSetCookie(r);
  const body = await readJson(r);
  return { r, body };
}

async function main() {
  // Health
  let r = await fetch(`${base}/api/ai/health`);
  const health = await readJson(r);
  ok('GET /api/ai/health', r.ok && Boolean(health), JSON.stringify(health).slice(0, 140));

  // Session
  r = await fetch(`${base}/api/auth/session`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  parseSetCookie(r);
  const session = await readJson(r);
  ok(
    'GET /api/auth/session anonymous',
    r.ok && session.authenticated === true && String(session.userId || '').startsWith('anonymous:'),
    String(session.userId || ''),
  );
  const csrf = session.csrfToken || jar.atlas_csrf;
  ok('CSRF token present', Boolean(csrf), String(csrf || '').slice(0, 12));

  // Chat greeting
  let chatBody;
  ({ r, body: chatBody } = await chat(csrf, 'Merhaba'));
  ok(
    'POST /api/chat greeting',
    r.ok && typeof chatBody.reply === 'string' && chatBody.reply.length > 0,
    String(chatBody.reply || chatBody.error || '').slice(0, 100),
  );

  // Conversation quality samples (non-memory)
  const qualityPrompts = [
    'Merhaba, bugün biraz düşünceliyim.',
    'İnsanlar neden bazen birine değer verdiği hâlde mesafeli davranır?',
    'Bu konuda kesin konuşabilir misin?',
    'Bilmiyorsan açıkça söyle.',
    'Bana kısa cevap ver.',
  ];
  let history = [];
  for (const msg of qualityPrompts) {
    ({ r, body: chatBody } = await chat(csrf, msg, history));
    const reply = String(chatBody.reply || '');
    const pass =
      r.ok &&
      reply.length > 0 &&
      !/stack trace|OPENAI_API_KEY|atlas_identity\.md|process\.env/i.test(reply) &&
      chatBody.engine !== 'memory';
    ok(`Conv quality: ${msg.slice(0, 42)}`, pass, `engine=${chatBody.engine} len=${reply.length} ${reply.slice(0, 70)}`);
    if (pass) {
      history = [
        ...history,
        { role: 'user', content: msg },
        { role: 'assistant', content: reply },
      ].slice(-8);
    }
  }

  // Continuity
  ({ r, body: chatBody } = await chat(csrf, 'Bir önceki cevabında ne demek istedin?', history));
  ok(
    'Conv continuity follow-up',
    r.ok && String(chatBody.reply || '').length > 0 && chatBody.engine !== 'memory',
    String(chatBody.reply || '').slice(0, 90),
  );

  // Memory false positive (exact regression sentence)
  const FAIL =
    'Atlas insanlara iletişim için adım attığında neden normal insanlar gibi cevap vermezler, beni gözlerinde büyüttükleri için tribe mi giriyorlar yoksa tarafımdan seçilmiş olmak mı?';
  ({ r, body: chatBody } = await chat(csrf, FAIL));
  ok(
    'Memory false-positive: adım attığında',
    r.ok &&
      chatBody.memoryUpdated !== true &&
      chatBody.engine !== 'memory' &&
      !String(chatBody.reply || '').includes('kaydettim') &&
      String(chatBody.reply || '').length > 0,
    `engine=${chatBody.engine} mem=${chatBody.memoryUpdated} ${String(chatBody.reply || '').slice(0, 80)}`,
  );

  const negatives = [
    'Adım atınca neden cevap vermiyorlar?',
    'Benim adım ne olabilir sence?',
    'Ad konusu neden bu kadar önemli?',
    'Bunu düşünmek beni yoruyor.',
    'Hatırlamak neden bazen zor?',
    'Kaydetmek ile hatırlamak aynı şey mi?',
  ];
  for (const msg of negatives) {
    ({ r, body: chatBody } = await chat(csrf, msg));
    ok(
      `Neg mem: ${msg.slice(0, 40)}`,
      r.ok &&
        chatBody.memoryUpdated !== true &&
        chatBody.engine !== 'memory' &&
        !String(chatBody.reply || '').includes('kaydettim'),
      `engine=${chatBody.engine}`,
    );
  }

  // Explicit memory write
  ({ r, body: chatBody } = await chat(csrf, 'Adım Dilek, bunu hatırla.'));
  ok(
    'Explicit name save',
    r.ok &&
      (chatBody.memoryUpdated === true ||
        /kaydettim|hatır/i.test(String(chatBody.reply || ''))),
    `engine=${chatBody.engine} ${String(chatBody.reply || '').slice(0, 80)}`,
  );

  // Preference save
  ({ r, body: chatBody } = await chat(csrf, 'En sevdiğim renk siyah, bunu hafızana kaydet.'));
  ok(
    'Explicit preference save',
    r.ok &&
      (chatBody.memoryUpdated === true || /kaydettim/i.test(String(chatBody.reply || ''))),
    `engine=${chatBody.engine} ${String(chatBody.reply || '').slice(0, 80)}`,
  );

  // Negation
  ({ r, body: chatBody } = await chat(csrf, 'Bu bilgiyi kaydetme.'));
  ok(
    'Negation blocks write',
    r.ok && chatBody.memoryUpdated !== true && chatBody.engine !== 'memory',
    `engine=${chatBody.engine}`,
  );

  // Forget
  ({ r, body: chatBody } = await chat(csrf, 'Az önce kaydettiğin bilgiyi unut.'));
  ok(
    'Forget request handled',
    r.ok && String(chatBody.reply || '').length > 0,
    `engine=${chatBody.engine} ${String(chatBody.reply || '').slice(0, 80)}`,
  );

  // Inspect stored memory for session user
  const uid = session.userId;
  r = await fetch(`${base}/api/memory/${encodeURIComponent(uid)}`, {
    headers: { Cookie: cookieHeader(), Origin: 'http://localhost:5173' },
  });
  const mem = await readJson(r);
  ok('Own memory readable', r.ok, JSON.stringify(mem).slice(0, 160));

  // Cross-user blocked
  r = await fetch(`${base}/api/memory/${encodeURIComponent('web:other-user-xyz')}`, {
    headers: { Cookie: cookieHeader(), Origin: 'http://localhost:5173' },
  });
  ok('Cross-user memory blocked', r.status === 401 || r.status === 403, `status=${r.status}`);

  // Assets security (must require auth for release)
  r = await fetch(`${base}/api/assets`);
  ok('SECURITY: GET /api/assets requires auth', !r.ok, `status=${r.status}`);
  r = await fetch(`${base}/api/assets/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ package: { topic: 'pwn', script: 'x' } }),
  });
  ok('SECURITY: POST /api/assets/save requires auth', !r.ok, `status=${r.status}`);

  // Admin
  r = await fetch(`${base}/api/admin/me`, { headers: { Cookie: cookieHeader() } });
  ok('Admin denied for anonymous', r.status === 401 || r.status === 403, `status=${r.status}`);

  // Symbolic analysis
  r = await fetch(`${base}/api/symbolic-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      'X-Atlas-Csrf': csrf,
      Cookie: cookieHeader(),
    },
    body: JSON.stringify({
      name: 'Dilek',
      birthDate: '1990-01-15',
      consents: { interpretive: true, dataUse: true },
    }),
  });
  const sym = await readJson(r);
  const symOk =
    r.ok &&
    (sym.report ||
      sym.result ||
      sym.sections ||
      sym.status ||
      sym.analysis ||
      sym.layers);
  ok('POST /api/symbolic-analysis', Boolean(symOk), JSON.stringify(sym).slice(0, 180));

  // Invalid login
  r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      'X-Atlas-Csrf': csrf,
      Cookie: cookieHeader(),
    },
    body: JSON.stringify({ username: 'nope', password: 'wrong' }),
  });
  ok('Invalid login fails', !r.ok, `status=${r.status}`);

  // Empty login
  r = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      'X-Atlas-Csrf': csrf,
      Cookie: cookieHeader(),
    },
    body: JSON.stringify({ username: '', password: '' }),
  });
  ok('Empty login fails', !r.ok, `status=${r.status}`);

  // Frontend smoke (if Vite up)
  try {
    const fr = await fetch('http://127.0.0.1:5173/', { signal: AbortSignal.timeout(5000) });
    const html = await fr.text();
    ok('Frontend serves index', fr.ok && html.includes('root'), `status=${fr.status}`);
    ok(
      'No INTERACT placeholder in HTML shell',
      !/\bINTERACT\b/.test(html) && !/KEŞFEDİLEN/.test(html),
      'shell check',
    );
  } catch (e) {
    ok('Frontend serves index', false, String(e.message || e));
  }

  const failed = results.filter((x) => !x.pass);
  console.log(`\nSUMMARY ${results.filter((x) => x.pass).length}/${results.length} failed=${failed.length}`);
  if (failed.length) {
    console.log(JSON.stringify(failed, null, 2));
  }
  process.exit(failed.length ? 1 : 0);
}

// Fix duplicate chat call introduced during drafting — clean entry:
main().catch((err) => {
  console.error(err);
  process.exit(1);
});

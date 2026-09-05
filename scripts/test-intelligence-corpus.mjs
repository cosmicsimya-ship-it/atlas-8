/**
 * Intelligence evaluation corpus (P0 intelligence foundation, Part D).
 *
 * Hand-labeled ground-truth corpus judging server/intelligence/shadow-arbiter.js
 * (Part C) + server/intelligence/confidence-gate.js (Part A). Each case names
 * the domain/action a correct router SHOULD produce for that message; this
 * file is deliberately what disagreement.js's own header defers to ("it
 * never decides which side was 'right'; that judgment is the eval corpus's
 * job (scripts/test-intelligence-corpus.mjs)") — so treat a failing case
 * here as a real shadow-arbiter/confidence-gate defect, not noise.
 *
 * Read-only: only imports server/intelligence/* (which itself only calls
 * existing intent *detectors*, never an execution/reply path — see
 * shadow-arbiter.js's header). Never touches processAtlasMessage, never
 * calls a model, no network, no engine execution, no live routing effect.
 * Deterministic and fast enough to run on every change to server/intelligence/
 * or the detectors it reuses.
 *
 * Run: node scripts/test-intelligence-corpus.mjs
 */
import { runShadowArbiter } from '../server/intelligence/shadow-arbiter.js';
import { classifyDisagreement, DISAGREEMENT_CATEGORIES } from '../server/intelligence/disagreement.js';
import { applyConfidenceGate, DEFAULT_CONFIDENCE_THRESHOLD } from '../server/intelligence/confidence-gate.js';

let passed = 0;
let failed = 0;
const failures = [];
function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Suite 1 — Confidence Gate (Part A), pure unit assertions
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 1: Confidence Gate ===');

{
  const gate = applyConfidenceGate([{ domain: 'tarot', score: 0.9 }], {});
  record('A1: confident top candidate routes', gate.action === 'route' && gate.selectedDomain === 'tarot');
}
{
  const gate = applyConfidenceGate([{ domain: 'tarot', score: 0.5 }, { domain: 'dream', score: 0.05 }], {});
  record('A1: below-threshold single real candidate falls back to generic', gate.action === 'generic');
}
{
  const gate = applyConfidenceGate([{ domain: 'tarot', score: 0.55 }, { domain: 'astrology', score: 0.45 }], {});
  record(
    'A4: close low-confidence pair triggers targeted clarify, not silent pick',
    gate.action === 'clarify' && gate.clarificationCandidates.join(',') === 'tarot,astrology',
  );
}
{
  const gate = applyConfidenceGate([{ domain: 'numerology', score: 0.3 }], {
    explicitDomain: 'tarot',
  });
  record(
    'A3: explicit domain request bypasses ambiguity gating outright',
    gate.action === 'explicit-switch' && gate.selectedDomain === 'tarot',
  );
}
{
  const gate = applyConfidenceGate([{ domain: 'ebced', score: 0.4 }], {
    activeOperationDomain: 'ebced',
    hasResolvedReferent: true,
  });
  record(
    'A2: resolved-referent continuation of active operation routes despite low raw score',
    gate.action === 'route' && gate.selectedDomain === 'ebced' && gate.reason === 'active_operation_continuation',
  );
}
{
  const gate = applyConfidenceGate([], {});
  record('no candidates falls back to generic, never crashes', gate.action === 'generic' && gate.selectedDomain === null);
}
{
  record('default threshold constant is stable', DEFAULT_CONFIDENCE_THRESHOLD === 0.65);
}

// ═══════════════════════════════════════════════════════════════════════
// Suite 2 — Shadow Arbiter routing corpus (Part C), ground-truth labeled
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 2: Shadow Arbiter Corpus ===');

/**
 * @typedef {{
 *   id: string,
 *   message: string,
 *   history?: { role: string, content: string }[],
 *   conversationId?: string,
 *   userId?: string|null,
 *   expectedDomain: string|null,
 *   expectedAction?: 'route'|'clarify'|'generic'|'explicit-switch',
 *   notes: string,
 * }} CorpusCase
 */

/** @type {CorpusCase[]} */
const CORPUS = [
  // ── ebced / abjad — explicit keyword + name construction ──
  {
    id: 'ebced-name-value-question',
    message: "Lara isminin ebced değeri kaç olur?",
    expectedDomain: 'ebced',
    expectedAction: 'explicit-switch',
    notes: 'explicit "ebced" keyword (A3 explicit-domain bypass) + "<name> isminin ebced" construction -> ebced; must outrank generic entity/profile retrieval (full-debug-sweep Ebced repro).',
  },
  {
    id: 'ebced-name-calc-imperative',
    message: "Atlas Lara'nın ebced hesabını yap",
    expectedDomain: 'ebced',
    expectedAction: 'explicit-switch',
    notes: 'explicit ebced keyword (A3 bypass) + calc hint ("hesabını") + apostrophe-name construction.',
  },
  {
    id: 'ebced-bare-explicit',
    message: 'Lara ebced',
    expectedDomain: 'ebced',
    expectedAction: 'explicit-switch',
    notes: 'terse explicit ebced keyword (A3 bypass) alongside a bare name.',
  },
  {
    id: 'ebced-arbitrary-name-not-in-kb',
    message: "Zeynep isminin ebced değerini hesapla",
    expectedDomain: 'ebced',
    expectedAction: 'explicit-switch',
    notes: 'arbitrary Latin name not in any curated KB — must not require KB membership (ADR-010 generic transliteration path).',
  },
  {
    id: 'ebced-explicit-request-no-name',
    message: 'Ebced hesabı yapar mısın?',
    expectedDomain: 'ebced',
    expectedAction: 'explicit-switch',
    notes: 'bare "ebced hesapla"-shaped request without a name still activates calculate (asks confirmation) per abjad-verification.js.',
  },

  // ── tarot — explicit spread commands ──
  {
    id: 'tarot-open-spread',
    message: 'Tarot aç.',
    expectedDomain: 'tarot',
    expectedAction: 'explicit-switch',
    notes: 'canonical explicit spread command from confidence-gate.js A3 doc example.',
  },
  {
    id: 'tarot-three-card',
    message: 'Sen 3 kart aç',
    expectedDomain: 'tarot',
    expectedAction: 'route',
    notes: 'full-debug-sweep Telegram repro B — explicit tarot card-count spread request.',
  },
  {
    id: 'tarot-reveal-cards',
    message: 'Hangi kartlar çıktı?',
    expectedDomain: 'tarot',
    expectedAction: 'route',
    notes: 'detectTarotSpreadIntent "hangi kartlar" reveal-cards path.',
  },

  // ── dream — explicit "rüya" keyword ──
  {
    id: 'dream-report',
    message: 'Rüyamda büyük bir deniz gördüm, ne anlama geliyor?',
    expectedDomain: 'dream',
    expectedAction: 'route',
    notes: 'explicit dream-report language; strong dream keyword + interpretation ask.',
  },
  {
    id: 'dream-followup-deep',
    message: 'Bu rüyayı Jung yaklaşımıyla detaylı analiz eder misin?',
    expectedDomain: 'dream',
    expectedAction: 'route',
    notes: 'explicit dream keyword + deep-analysis depth hint.',
  },

  // ── numerology — explicit "numeroloji" keyword ──
  {
    id: 'numerology-full-analysis',
    message: '27.01.1986 doğum tarihime göre numeroloji analizi yap',
    expectedDomain: 'numerology',
    expectedAction: 'explicit-switch',
    notes: 'explicit numerology keyword (A3 bypass) + birth date -> full_analysis intent.',
  },

  // ── astrology — explicit "astroloji" keyword ──
  {
    id: 'astrology-explicit',
    message: 'Astrolojik olarak bugün Koç burcu için ne diyorsun?',
    expectedDomain: 'astrology',
    expectedAction: 'route',
    notes: 'explicit astrology keyword + zodiac target + date-specific framing.',
  },

  // ── quran — explicit verse reference / topic ──
  {
    id: 'quran-verse-reference',
    message: '48:29 ayeti nedir?',
    expectedDomain: 'quran',
    expectedAction: 'explicit-switch',
    notes: 'explicit "ayet" keyword (A3 bypass) + surah:verse reference + lookup verb (valid reference case from full-debug-sweep).',
  },
  {
    id: 'quran-invalid-verse-reference',
    message: '48:84 ayet nedir?',
    expectedDomain: 'quran',
    expectedAction: 'explicit-switch',
    notes: 'invalid verse (Fetih has 29 ayet) — arbiter only proposes ROUTING to the Quran domain; deterministic in-range validation is the quran-verse-lookup engine\'s own job, not the arbiter\'s (full-debug-sweep repro).',
  },
  {
    id: 'quran-named-surah',
    message: 'Fetih suresi kaç ayettir?',
    expectedDomain: 'quran',
    expectedAction: 'explicit-switch',
    notes: 'named surah + explicit "sure"/"ayet" keywords (A3 bypass).',
  },

  // ── ambiguous / low-confidence — no strong domain cue ──
  {
    id: 'ambiguous-greeting',
    message: 'Selam Atlas',
    expectedDomain: null,
    expectedAction: 'generic',
    notes: 'plain greeting carries no domain-specific evidence at all — must not force a specialized route (full-debug-sweep Telegram repro A, turn 1).',
  },
  {
    id: 'ambiguous-short-ack',
    message: 'Evet',
    expectedDomain: null,
    expectedAction: 'generic',
    notes: 'bare acknowledgement with no active-operation context and no referent — generic, not a forced route.',
  },
  {
    id: 'ambiguous-open-question',
    message: 'Naber, nasıl gidiyor?',
    expectedDomain: null,
    expectedAction: 'generic',
    notes: 'no date/numerology/tarot/etc cue — plain conversational question.',
  },

  // ── explicit self-correction — rejected domain must never win ──
  {
    id: 'correction-rejects-tarot',
    message: 'Tarot istemedim, onu sormadım',
    expectedDomain: null,
    expectedAction: 'generic',
    conversationId: 'corpus-correction-tarot',
    history: [
      { role: 'user', content: 'Tarot aç.' },
      { role: 'assistant', content: 'Kartları açıyorum...' },
    ],
    notes: 'C1 self-correction: explicit rejection of the domain Atlas just used must delete that candidate, not silently keep routing to it.',
  },

  // ── explicit domain switch away from an active operation ──
  {
    id: 'explicit-switch-mid-tarot-to-ebced',
    message: "Bırak tarotu, Furkan'ın ebcedini hesapla.",
    expectedDomain: 'ebced',
    expectedAction: 'explicit-switch',
    conversationId: 'corpus-switch-tarot-ebced',
    history: [
      { role: 'user', content: 'Tarot aç.' },
      { role: 'assistant', content: 'Kartları açıyorum...' },
    ],
    notes: 'confidence-gate.js A3 doc example — explicit current-message domain request must override stale tarot continuation.',
  },
];

const domainTally = new Map();
const actionTally = new Map();
const disagreementTally = new Map();

for (const c of CORPUS) {
  const shadow = runShadowArbiter({
    message: c.message,
    history: c.history || [],
    conversationId: c.conversationId || `corpus-${c.id}`,
    userId: c.userId ?? null,
  });

  domainTally.set(shadow.selectedDomain ?? 'none', (domainTally.get(shadow.selectedDomain ?? 'none') || 0) + 1);
  actionTally.set(shadow.action, (actionTally.get(shadow.action) || 0) + 1);

  const domainOk = shadow.selectedDomain === c.expectedDomain;
  const actionOk = c.expectedAction ? shadow.action === c.expectedAction : true;
  const ok = domainOk && actionOk;

  if (!ok) {
    const category = classifyDisagreement({
      legacyDomain: c.expectedDomain,
      legacyEngine: null,
      legacyTopicShift: null,
      shadow,
    });
    disagreementTally.set(category ?? 'uncategorized', (disagreementTally.get(category ?? 'uncategorized') || 0) + 1);
  }

  record(
    `corpus:${c.id}`,
    ok,
    ok
      ? `${shadow.action}/${shadow.selectedDomain ?? 'none'}`
      : `expected ${c.expectedAction ?? 'any'}/${c.expectedDomain ?? 'none'}, got ${shadow.action}/${shadow.selectedDomain ?? 'none'} (reason=${shadow.reason})`,
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Suite 3 — Disagreement classification (Part E), unit assertions
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Suite 3: Disagreement Classification ===');

{
  const shadow = {
    selectedDomain: 'tarot',
    action: 'route',
    reason: 'confident_top_candidate',
    candidateDomains: [{ domain: 'tarot', score: 0.9, evidence: ['tarot_spread_intent'] }],
    topicShiftDetected: false,
  };
  const category = classifyDisagreement({ legacyDomain: 'tarot', legacyEngine: 'tarot-engine', legacyTopicShift: false, shadow });
  record('agreement (domain + engine + topic-shift) classifies as null', category === null);
}
{
  const shadow = {
    selectedDomain: null,
    action: 'generic',
    reason: 'low_confidence_below_threshold',
    candidateDomains: [{ domain: 'tarot', score: 0.325, evidence: ['symbolic_context_primary', 'symbolic_context_secondary'] }],
    topicShiftDetected: false,
  };
  const category = classifyDisagreement({ legacyDomain: 'tarot', legacyEngine: 'tarot-engine', legacyTopicShift: false, shadow });
  record(
    'legacy specialized into a stale-only-evidence candidate the shadow gate declined -> stale-domain-overreach',
    category === 'stale-domain-overreach',
  );
}
{
  const shadow = {
    selectedDomain: null,
    action: 'generic',
    reason: 'low_confidence_below_threshold',
    candidateDomains: [{ domain: 'ebced', score: 0.4, evidence: ['abjad_intent'] }],
    topicShiftDetected: false,
  };
  const category = classifyDisagreement({ legacyDomain: 'ebced', legacyEngine: 'abjad-verification', legacyTopicShift: false, shadow });
  record(
    'legacy specialized where shadow found current-message evidence but still declined to route -> false-positive-specialized-domain',
    category === 'false-positive-specialized-domain',
  );
}
{
  const shadow = {
    selectedDomain: 'quran',
    action: 'route',
    reason: 'confident_top_candidate',
    candidateDomains: [{ domain: 'quran', score: 0.95, evidence: ['quran_verse_intent'] }],
    topicShiftDetected: false,
  };
  const category = classifyDisagreement({ legacyDomain: null, legacyEngine: null, legacyTopicShift: false, shadow });
  record(
    'shadow found a confident specialized route legacy missed entirely -> explicit-signal-missed',
    category === 'explicit-signal-missed',
  );
}
{
  const shadow = {
    selectedDomain: 'ebced',
    action: 'route',
    reason: 'active_operation_continuation',
    candidateDomains: [],
    topicShiftDetected: false,
  };
  const category = classifyDisagreement({ legacyDomain: null, legacyEngine: null, legacyTopicShift: false, shadow });
  record(
    'shadow routed via a resolved-referent continuation legacy missed -> referent-continuation',
    category === 'referent-continuation',
  );
}
{
  const shadow = {
    selectedDomain: null,
    action: 'clarify',
    reason: 'ambiguous_between_candidates',
    candidateDomains: [
      { domain: 'tarot', score: 0.55, evidence: ['tarot_spread_intent'] },
      { domain: 'astrology', score: 0.45, evidence: ['astrology_flow'] },
    ],
    topicShiftDetected: false,
  };
  const category = classifyDisagreement({ legacyDomain: 'tarot', legacyEngine: 'tarot-engine', legacyTopicShift: false, shadow });
  record('shadow recommends a targeted clarify legacy skipped -> ambiguous-low-confidence', category === 'ambiguous-low-confidence');
}
{
  const shadow = {
    selectedDomain: 'tarot',
    action: 'route',
    reason: 'confident_top_candidate',
    candidateDomains: [{ domain: 'tarot', score: 0.9, evidence: ['tarot_spread_intent'] }],
    topicShiftDetected: true,
  };
  const category = classifyDisagreement({ legacyDomain: 'tarot', legacyEngine: 'tarot-engine', legacyTopicShift: false, shadow });
  record('domain/engine agree but topic-shift flag disagrees -> topic-shift-disagreement', category === 'topic-shift-disagreement');
}
{
  const category = classifyDisagreement({ legacyDomain: 'tarot', legacyEngine: null, legacyTopicShift: null, shadow: null });
  record('no shadow proposal to compare against -> null, never throws', category === null);
}
{
  record(
    'DISAGREEMENT_CATEGORIES export is non-empty and stable',
    Array.isArray(DISAGREEMENT_CATEGORIES) && DISAGREEMENT_CATEGORIES.length === 7,
  );
}

// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Corpus metrics ===');
console.log(`corpus size: ${CORPUS.length}`);
console.log(`domain distribution: ${JSON.stringify(Object.fromEntries(domainTally))}`);
console.log(`action distribution: ${JSON.stringify(Object.fromEntries(actionTally))}`);
console.log(`disagreement categories on misses: ${JSON.stringify(Object.fromEntries(disagreementTally))}`);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

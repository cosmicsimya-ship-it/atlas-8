/**
 * Regression matrix for the general Atlas Intelligence Layer hardening —
 * topic-shift detection, domain confidence, and false-positive routing.
 * Covers TEST A-J from the hardening task (not tarot-only: also exercises
 * ebced and numerology continuation/topic-shift).
 * Run: node scripts/test-topic-shift-routing.mjs
 */
import { resolveSymbolicContext, clearSymbolicDomain, rememberSymbolicDomain } from '../server/symbolic-context.js';
import { detectTarotSpreadIntent } from '../server/symbolic-synthesis.js';
import { tryTarotFlowReply } from '../server/tarot-flow.js';
import { touchTarotSession, clearTarotSession } from '../server/tarot-engine/session.js';
import { detectAbjadEsmaIntent, isExplicitEbcedEsmaMatchAsk } from '../server/abjad-verification.js';
import { detectNumerologyIntent } from '../server/numerology-engine/intent.js';
import { detectDateSignal, detectCorrectionSignal } from '../server/topic-shift.js';
import { resetConversationState, getConversationState } from '../server/conversation-context-engine.js';

let passed = 0;
let failed = 0;

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const user = 'web:topic-shift-user';

// ── TEST A: date must not become tarot (stale-free) ────────────────────
{
  const conv = 'topic-shift-a';
  resetConversationState(conv);
  try { clearTarotSession?.(conv, user); } catch { /* optional */ }
  const msg = 'Bugün 5/9/26';
  const tarotIntent = detectTarotSpreadIntent(msg, []);
  record('A: tarot engine not active on bare date', tarotIntent.active === false, JSON.stringify(tarotIntent));
  const ctx = resolveSymbolicContext({ message: msg, history: [], conversationId: conv, userId: user });
  record('A: symbolic primaryDomain !== tarot', ctx.primaryDomain !== 'tarot', ctx.primaryDomain);
  record('A: date signal detected', detectDateSignal(msg).active === true);
  record('A: symbolic date_pattern route considered', ctx.primaryDomain === 'date_pattern', ctx.primaryDomain);
}

// ── TEST B: explicit tarot wins even with a date word ───────────────────
{
  const conv = 'topic-shift-b';
  resetConversationState(conv);
  try { clearTarotSession?.(conv, user); } catch { /* optional */ }
  const msg = 'Bugün için tarot aç.';
  const tarotIntent = detectTarotSpreadIntent(msg, []);
  record('B: tarot engine active on explicit ask', tarotIntent.active === true, JSON.stringify(tarotIntent));
  const ctx = resolveSymbolicContext({ message: msg, history: [], conversationId: conv, userId: user });
  record('B: symbolic primaryDomain === tarot', ctx.primaryDomain === 'tarot', ctx.primaryDomain);
}

// ── TEST C: ebced continuation ("Esması?" after a verified total) ──────
{
  const history = [
    { role: 'user', content: "Furkan'ın ebcedi nedir?" },
    { role: 'assistant', content: 'Furkan isminin ebced toplamı 431 ediyor.' },
  ];
  const intent = detectAbjadEsmaIntent('Esması?', history);
  record('C: ebced domain persists for Esması?', intent.active === true && intent.kind === 'esma_match', JSON.stringify(intent));
  record('C: continuation resolves target from prior total', intent.targetValue === 431, intent.targetValue);
}

// ── TEST D: topic shift from ebced to date ──────────────────────────────
{
  const history = [
    { role: 'user', content: "Furkan'ın ebcedi nedir?" },
    { role: 'assistant', content: 'Furkan isminin ebced toplamı 431 ediyor.' },
  ];
  const intent = detectAbjadEsmaIntent('Bugün 5/9/26', history);
  record('D: ebced domain does not persist on date shift', intent.active === false, JSON.stringify(intent));
}

// ── TEST E: stale tarot history must not hijack a date message ─────────
{
  const conv = 'topic-shift-e';
  resetConversationState(conv);
  const staleHistory = [
    { role: 'user', content: 'Tarot açılımı yap, aklımdaki kişi için.' },
    { role: 'assistant', content: 'Üç kartlık açılım: ... enerjisi güçlü.' },
  ];
  try { clearTarotSession?.(conv, user); } catch { /* optional */ }
  const msg = 'Bugün 5/9/26';
  const tarotIntent = detectTarotSpreadIntent(msg, staleHistory);
  record('E: tarot engine not reactivated by stale history', tarotIntent.active === false, JSON.stringify(tarotIntent));
  const ctx = resolveSymbolicContext({ message: msg, history: staleHistory, conversationId: conv, userId: user });
  record('E: symbolic context not tarot despite stale history', ctx.primaryDomain !== 'tarot', ctx.primaryDomain);
}

// ── TEST F: self-correction ("Tarot ne alaka?") ─────────────────────────
{
  const conv = 'topic-shift-f';
  resetConversationState(conv);
  rememberSymbolicDomain(conv, 'tarot');
  const msg = 'Tarot ne alaka?';
  const correction = detectCorrectionSignal(msg);
  record('F: correction signal detected', correction.active === true);
  const ctx = resolveSymbolicContext({ message: msg, history: [], conversationId: conv, userId: user });
  record('F: wrong domain not re-asserted as primary', ctx.primaryDomain !== 'tarot', ctx.primaryDomain);
  record('F: selfCorrectionTriggered flag set', ctx.selfCorrectionTriggered === true);
  record('F: domainRejected reports tarot', ctx.domainRejected === 'tarot', ctx.domainRejected);
  record(
    'F: stored domain cleared after correction',
    getConversationState(conv).symbolicDomain !== 'tarot',
  );
}

// ── TEST G: generic social message ──────────────────────────────────────
{
  const conv = 'topic-shift-g';
  resetConversationState(conv);
  const msg = 'Nasılsın?';
  const ctx = resolveSymbolicContext({ message: msg, history: [], conversationId: conv, userId: user });
  record('G: no specialized domain forced', ctx.primaryDomain === null, ctx.primaryDomain);
}

// ── TEST H: open-ended insight request ──────────────────────────────────
{
  const conv = 'topic-shift-h';
  resetConversationState(conv);
  const msg = 'Bana bilmediğim ama bilsem mutlu olacağım bir şey söyle.';
  const ctx = resolveSymbolicContext({ message: msg, history: [], conversationId: conv, userId: user });
  record('H: no forced tarot', ctx.primaryDomain !== 'tarot', ctx.primaryDomain);
}

// ── TEST I: explicit numerology (date word present, numerology should win) ─
{
  const msg = 'Bugünün numerolojisini hesapla.';
  const numIntent = detectNumerologyIntent(msg, []);
  record('I: numerology intent active', numIntent.active === true, JSON.stringify(numIntent));
}

// ── TEST J: explicit Qur'an reference must not be treated as tarot/date ─
{
  const conv = 'topic-shift-j';
  resetConversationState(conv);
  const msg = "Yusuf 12:87'yi açıkla.";
  const tarotIntent = detectTarotSpreadIntent(msg, []);
  record('J: not routed to tarot', tarotIntent.active === false, JSON.stringify(tarotIntent));
  const ctx = resolveSymbolicContext({ message: msg, history: [], conversationId: conv, userId: user });
  record('J: not routed to date_pattern instead of quran', ctx.primaryDomain !== 'date_pattern', ctx.primaryDomain);
}

// ── Regression: existing valid continuations must still work ───────────
{
  const conv = 'topic-shift-reg-1';
  resetConversationState(conv);
  touchTarotSession({
    conversationId: conv,
    userId: user,
    intention: 'aklimdaki kisi',
    spreadKind: 'three_card',
    cardIds: ['wands_01', 'cups_02', 'swords_03'],
    cardNames: ['Değnek Ası', 'Kupa İkilisi', 'Kılıç Üçlüsü'],
    positions: [],
    selectionSeed: 'test',
  });
  const reply = tryTarotFlowReply({
    message: 'bir kart daha çek',
    history: [{ role: 'assistant', content: 'Üç kartlık bir açılım...' }],
    userId: user,
    conversationId: conv,
  });
  record('REG: legit "bir kart daha çek" continuation still handled', Boolean(reply?.handled), JSON.stringify(reply?.intent));
}

{
  // Symbolic-context arbiter's own short-follow-up preservation must still work.
  const conv = 'topic-shift-reg-2';
  resetConversationState(conv);
  const moreCtx = resolveSymbolicContext({
    message: 'bir kart daha',
    history: [
      { role: 'user', content: 'Aklımdaki kişinin enerjisi' },
      { role: 'assistant', content: 'Üç kartlık bir açılım...' },
    ],
    conversationId: conv,
    userId: user,
  });
  record('REG: symbolic context preserves tarot on short follow-up', moreCtx.primaryDomain === 'tarot', moreCtx.primaryDomain);
}

{
  const history = [
    { role: 'user', content: "Furkan'ın ebcedi nedir?" },
    { role: 'assistant', content: 'Furkan isminin ebced toplamı 431 ediyor.' },
  ];
  record(
    'REG: unrelated "esma nedir" with no prior total does not activate',
    isExplicitEbcedEsmaMatchAsk('Esma nedir?', null) === false,
  );
}

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);

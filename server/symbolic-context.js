/**
 * Shared symbolic conversation context — first-class active domain for
 * tarot / dream / symbol / date-pattern / person / choice / numerology.
 *
 * Extends existing sessions + semantic-layers; does not replace engines.
 * Internal metadata only — never print [tarot]/[dream] markers to users.
 */

import { getTarotSession } from './tarot-engine/session.js';
import { getDreamSession } from './dream-engine/session.js';
import { getNumerologySession } from './numerology-engine/session.js';
import { hasTarotContext } from './symbolic-synthesis.js';
import {
  detectSemanticLayers,
  historyHasNumericPattern,
  isRepeatingNumberPattern,
} from './semantic-layers.js';
import { getConversationState } from './conversation-context-engine.js';
import { wantsQuranExplanation } from './quran-verse-lookup/explanation.js';

export const SYMBOLIC_CONTEXT_VERSION = 'atlas-symbolic-context-v1';

/** @typedef {'tarot'|'dream'|'symbol'|'date_pattern'|'person'|'choice'|'numerology'|'pattern'|'astrology'|'quran'|null} SymbolicDomainId */

const SHORT_FOLLOWUP_RE =
  /^(a[cç]|bir\s+daha|[uü][cç]\s+tane|devam(\s+et)?|buna\s+bak|yorumla|kart\s+[cç]ek|tekrar(\s+a[cç])?|bu\s+ne\s+demek|peki\s+bu\s+ki[sş]i|ayn[ıi]\s+[sş]ey\s+yine\s+oldu|bu\s+tarih|yine\s+yazd[ıi]|yine\s+oldu|kart\s+a[cç]|[uü][cç]\s+kart(\s+a[cç])?|bir\s+kart\s+daha|daha\s+detayl[ıi](\s+yazabilir\s+misin)?|detayl[ıi]\s+yaz|mesela|mesel[aâ]|[oö]rnek(\s+ver)?|nas[ıi]l\s+yani|bunu\s+a[cç]|birinci(si)?|ikinci(si)?|üçüncü(sü)?|hangisi)[.!?…]*$/iu;

const SYMBOLIC_FOLLOWUP_RE =
  /(?:a[cç][ıi]l[ıi]m|kart\s+a[cç]|kart\s+[cç]ek|yorumla|r[uü]ya|sembol|tarih|tekrar|devam|bir\s+daha|bu\s+ki[sş]i|bu\s+tarih|bu\s+sembol|bu\s+se[cç]im|yine\s+(?:yazd[ıi]|oldu|[cç][ıi]kt)|daha\s+detayl[ıi])/i;

const EXPLICIT_DOMAIN_SWITCH =
  /\b(tarot|r[uü]ya|numeroloji|mix(?:ing)?|master(?:ing)?|\bstem\b|telegram|fatura|abonelik)\b/i;

const ASTROLOGY_DOMAIN_RE =
  /(?:astroloj|bur[cç]|transit|g[oö]ky[uü]z|(?<!\p{L})(?:ko[cç]|bo[gğ]a|[iı]kizler|yenge[cç]|aslan|ba[sş]ak|terazi|akrep|yay|o[gğ]lak|kova|bal[iı]k)(?:lar|ler)?(?!\p{L}))/iu;

const DATE_BOUND_ASTRO_RE =
  /(?:\d{1,2}\s+(?:ocak|[sş]ubat|mart|nisan|may[iı]s|haziran|temmuz|a[gğ]ustos|eyl[uü]l|ekim|kas[iı]m|aral[iı]k)\w*|\byar[ıi]n\b|\bbu\s+hafta\b|\btutulma\b)/iu;

/** Unrelated capability tokens that must not appear under symbolic follow-ups. */
export const UNRELATED_CAPABILITY_RE =
  /\b(telegram|mix(?:ing)?|master(?:ing)?|\bstem\b|ses\s+dosya|aranje|voice\s+process|billing|fatura|abonelik|archive|ar[sş]iv|st[uü]dyo\s+mod)\b/i;

const TAXONOMY_LEAK_RE =
  /\[(?:ki[sş]i|d[oö]nem|donem|se[cç]im|secim|tarot|dream|symbol|numerology|date_pattern|pattern|choice)\]/gi;

const DEBUG_TEMPLATE_RE =
  /^(Ortak\s+[cç]izgi|Ortak\s+tema|[OÖ]ne\s+[cç][ıi]kan\s+yap[ıi]|major\s+arcana\s+weight)\s*:/im;

const ABSOLUTE_SYMBOLIC_CLAIM_RE =
  /\b(kesin(likle)?\s+(seni\s+)?(seviyor|d[uü][sş][uü]n[uü]yor|geri\s+d[oö]necek)|evrenden\s+kesin\s+mesaj|kart\s+.{0,40}geri\s+d[oö]nece[gğ]ini\s+g[oö]ster\w*|r[uü]ya\s+.{0,40}olaca[gğ][ıi]n[ıi]\s+haber)\b/i;

/**
 * @param {string} message
 */
export function isShortSymbolicFollowUp(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  if (text.length > 80) return false;
  if (SHORT_FOLLOWUP_RE.test(text)) return true;
  // Low-info continuation with symbolic cue
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= 6 && SYMBOLIC_FOLLOWUP_RE.test(text);
}

/**
 * @param {string} message
 */
export function extractSymbolicReferents(message) {
  const text = String(message || '');
  /** @type {{ kind: string, raw: string }[]} */
  const referents = [];
  const patterns = [
    [/bu\s+ki[sş]i(?:nin|ye|yi|de)?/i, 'person'],
    [/akl[ıi]mdaki\s+ki[sş]i/i, 'person'],
    [/bu\s+tarih/i, 'date'],
    [/bu\s+r[uü]ya/i, 'dream'],
    [/bu\s+sembol/i, 'symbol'],
    [/bu\s+se[cç]im/i, 'choice'],
    [/bu\s+say[ıi]/i, 'number'],
    [/ayn[ıi]\s+r[uü]ya/i, 'dream'],
    [/\d{1,2}\s+(?:ocak|[sş]ubat|mart|nisan|may[iı]s|haziran|temmuz|a[gğ]ustos|eyl[uü]l|ekim|kas[iı]m|aral[iı]k)\w*/iu, 'date'],
    [/(?<!\p{L})(?:ko[cç]|bo[gğ]a|[iı]kizler|yenge[cç]|aslan|ba[sş]ak|terazi|akrep|yay|o[gğ]lak|kova|bal[iı]k)(?:lar|ler)?(?!\p{L})/iu, 'zodiac'],
  ];
  for (const [re, kind] of patterns) {
    const m = text.match(re);
    if (m) referents.push({ kind, raw: m[0] });
  }
  return referents;
}

/**
 * Collect live engine sessions for this conversation/user.
 * @param {{ conversationId?: string, userId?: string|null }} opts
 */
export function collectLiveSymbolicSessions(opts = {}) {
  const conversationId = opts.conversationId || 'default';
  const userId = opts.userId || null;
  /** @type {{ domain: SymbolicDomainId, updatedAt: number, meta?: object }[]} */
  const live = [];

  const tarot = getTarotSession(conversationId, userId);
  if (tarot) {
    live.push({
      domain: 'tarot',
      updatedAt: tarot.updatedAt,
      meta: {
        intention: tarot.intention,
        topic: tarot.topic,
        cardCount: tarot.cardIds?.length ?? 0,
      },
    });
  }
  const dream = getDreamSession(conversationId, userId);
  if (dream) {
    live.push({
      domain: 'dream',
      updatedAt: dream.updatedAt,
      meta: {
        narrative: dream.narrative?.slice(0, 120) || null,
        recurring: dream.recurring,
        symbols: dream.symbolNames || [],
      },
    });
  }
  const num = getNumerologySession(conversationId, userId);
  if (num) {
    live.push({
      domain: 'numerology',
      updatedAt: num.updatedAt,
      meta: { birthDate: num.birthDate, chart: num.chartSnapshot },
    });
  }

  live.sort((a, b) => b.updatedAt - a.updatedAt);
  return live;
}

/**
 * Resolve first-class symbolic context for this turn.
 * @param {{
 *   message: string,
 *   history?: { role?: string, content?: string }[],
 *   conversationId?: string,
 *   userId?: string|null,
 * }} input
 */
export function resolveSymbolicContext(input) {
  const message = String(input.message || '').trim();
  const history = input.history || [];
  const conversationId = input.conversationId || 'default';
  const userId = input.userId || null;

  const live = collectLiveSymbolicSessions({ conversationId, userId });
  const freshest = live[0] || null;
  const semantic = detectSemanticLayers(message, history);
  const conv = getConversationState(conversationId);
  const storedDomain =
    /** @type {SymbolicDomainId} */ (conv.symbolicDomain || null);
  const shortFollowUp = isShortSymbolicFollowUp(message);
  const referents = extractSymbolicReferents(message);
  // Inherit referents from recent user turns when short follow-up
  if (shortFollowUp && !referents.length) {
    for (const turn of [...history].reverse().slice(0, 6)) {
      if (turn?.role !== 'user') continue;
      const prior = extractSymbolicReferents(turn.content || '');
      if (prior.length) {
        referents.push(...prior);
        break;
      }
    }
  }

  /** @type {SymbolicDomainId[]} */
  const secondary = [];
  /** @type {SymbolicDomainId} */
  let primary = null;
  /** @type {string} */
  let action = 'interpret';
  const evidence = [];

  const explicitSwitch = EXPLICIT_DOMAIN_SWITCH.test(message) && !shortFollowUp;

  // Quran has no live-session store and its own short-follow-up phrasing
  // ("açıkla", "yorumla", "anlamı ne") doesn't always match the generic
  // SHORT_FOLLOWUP_RE below — recognize it explicitly, scoped to only when
  // the stored domain is already 'quran' so this never affects other domains.
  const quranContinuation =
    storedDomain === 'quran' && !explicitSwitch && wantsQuranExplanation(message);

  // History / live session affinity
  const tarotHist = hasTarotContext(history) || Boolean(freshest?.domain === 'tarot');
  const dreamHist =
    live.some((l) => l.domain === 'dream') ||
    semantic.layers.includes('dream') ||
    /\br[uü]ya\b/i.test(
      history
        .slice(-6)
        .map((h) => h.content || '')
        .join('\n'),
    );
  const patternHist =
    live.some((l) => l.domain === 'numerology') ||
    historyHasNumericPattern(history) ||
    isRepeatingNumberPattern(message, history);

  // Message-driven domain cues
  if (/(?:^|[^\p{L}])(tarot|kart\s+a[cç]|a[cç][ıi]l[ıi]m|\d+\s*kart)(?!\p{L})/iu.test(message)) {
    primary = 'tarot';
    action = /yorum/i.test(message) ? 'interpret' : 'draw';
    evidence.push('message_tarot');
  } else if (semantic.layers.includes('dream') || /(?:^|[^\p{L}])r[uü]ya(?!\p{L})/iu.test(message)) {
    primary = 'dream';
    evidence.push('message_dream');
  } else if (
    (ASTROLOGY_DOMAIN_RE.test(message) && DATE_BOUND_ASTRO_RE.test(message)) ||
    semantic.layers.includes('astrology')
  ) {
    primary = 'astrology';
    action = /detayl[ıi]|derine|kapsam/i.test(message) ? 'expand' : 'interpret';
    evidence.push('message_astrology');
  } else if (semantic.layers.includes('symbol')) {
    primary = 'symbol';
    evidence.push('message_symbol');
  } else if (patternHist && (shortFollowUp || isRepeatingNumberPattern(message, history))) {
    primary = 'date_pattern';
    evidence.push('message_pattern');
  } else if (/bu\s+ki[sş]i|yine\s+yazd|gidip\s+geri/i.test(message)) {
    primary = 'person';
    evidence.push('message_person');
  }

  // Short follow-up + strong active domain → preserve
  if ((shortFollowUp || quranContinuation) && !explicitSwitch) {
    if (freshest?.domain) {
      primary = freshest.domain;
      evidence.push('freshest_session');
    } else if (storedDomain) {
      primary = storedDomain;
      evidence.push('stored_domain');
    } else if (tarotHist) {
      primary = 'tarot';
      evidence.push('tarot_history');
    } else if (dreamHist) {
      primary = 'dream';
      evidence.push('dream_history');
    } else if (patternHist) {
      primary = 'date_pattern';
      evidence.push('pattern_history');
    } else if (
      storedDomain === 'astrology' ||
      /astroloj|bur[cç]|kova|transit/i.test(
        history
          .slice(-6)
          .map((h) => h.content || '')
          .join('\n'),
      )
    ) {
      primary = 'astrology';
      action = 'expand';
      evidence.push('astrology_history');
    }
  } else if (!primary && freshest?.domain && !explicitSwitch) {
    // Soft affinity without forcing
    if (shortFollowUp || SYMBOLIC_FOLLOWUP_RE.test(message)) {
      primary = freshest.domain;
      evidence.push('soft_freshest');
    }
  }

  // Multi-layer: keep secondary cues
  for (const id of semantic.layers) {
    const mapped =
      id === 'numerology'
        ? 'date_pattern'
        : id === 'date_time'
          ? 'date_pattern'
          : id === 'dream'
            ? 'dream'
            : id === 'symbol'
              ? 'symbol'
              : null;
    if (mapped && mapped !== primary && !secondary.includes(mapped)) {
      secondary.push(mapped);
    }
  }
  if (referents.some((r) => r.kind === 'person') && primary !== 'person') {
    if (!secondary.includes('person')) secondary.push('person');
  }
  if (dreamHist && primary === 'symbol' && !secondary.includes('dream')) {
    secondary.push('dream');
  }
  if (semantic.layers.includes('symbol') && primary === 'dream' && !secondary.includes('symbol')) {
    secondary.push('symbol');
  }

  const motif =
    freshest?.meta?.symbols?.[0] ||
    (message.match(/(kap[ıi]|anahtar|ayna|karga|y[ıi]lan)/i) || [])[0] ||
    null;

  const active =
    Boolean(primary) ||
    secondary.length > 0 ||
    referents.length > 0 ||
    live.length > 0;

  return {
    version: SYMBOLIC_CONTEXT_VERSION,
    active,
    primaryDomain: primary,
    secondaryDomains: secondary,
    referents,
    motif,
    requestedAction: action,
    interpretationMode: 'calibrated_hypothesis',
    shortFollowUp,
    freshestSessionDomain: freshest?.domain || null,
    liveSessions: live.map((l) => l.domain),
    semanticLayers: semantic.layers,
    evidence,
    preserveActiveDomain: Boolean((shortFollowUp || quranContinuation) && primary && !explicitSwitch),
  };
}

/**
 * Block unrelated capability when symbolic context owns a short follow-up.
 * @param {ReturnType<typeof resolveSymbolicContext>|null|undefined} ctx
 * @param {string} message
 */
export function shouldBlockUnrelatedCapability(ctx, message) {
  if (!ctx?.active) return false;
  const text = String(message || '');
  const clearOps =
    /\b(mix(?:ing)?|master(?:ing)?|\bstem\b|mp3|wav|fatura|abonelik)\b/i.test(text) &&
    !SYMBOLIC_FOLLOWUP_RE.test(text) &&
    !/\b(tarot|kart|r[uü]ya|sembol)\b/i.test(text);
  if (clearOps) return false;

  const symbolicPrimary = ['tarot', 'dream', 'symbol', 'date_pattern', 'person', 'choice', 'pattern', 'astrology'].includes(
    ctx.primaryDomain || '',
  );
  if (!symbolicPrimary && !ctx.preserveActiveDomain) return false;

  if (ctx.shortFollowUp || ctx.preserveActiveDomain) return true;
  if (SYMBOLIC_FOLLOWUP_RE.test(text) && symbolicPrimary) return true;
  return false;
}

/**
 * Internal prompt lock — natural meaning synthesis + referent continuity.
 * @param {ReturnType<typeof resolveSymbolicContext>} ctx
 */
export function buildSymbolicContextPromptLock(ctx) {
  if (!ctx?.active) return '';
  const refs = ctx.referents.map((r) => `${r.kind}:${r.raw}`).join(', ') || 'none';
  const secondary = ctx.secondaryDomains.join(', ') || 'none';
  return `
## SYMBOLIC CONTEXT LOCK (internal — do not print labels or bracket tags)
- primaryDomain: ${ctx.primaryDomain || 'none'}
- secondary: ${secondary}
- referents: ${refs}
- motif: ${ctx.motif || 'none'}
- mode: calibrated hypothesis — not prophecy, not mind-reading, not physical fact
- Preserve active domain on short follow-ups; do not switch to audio/Telegram/billing/ops.
- Symbol language is contextual role, not dictionary lookup ("X = Y").
- Multi-symbol: name reinforcement / contradiction / progression / blockage / repetition when present.
- Write natural prose answering the user question; avoid debug templates ("Ortak çizgi:", "Öne çıkan yapı:", major arcana weight).
- Never emit [kişi]/[dönem]/[seçim]/[tarot]/[dream] markers.
`.trim();
}

/**
 * Narrow post-guard for user-visible symbolic replies.
 * @param {string} reply
 * @param {{ symbolic?: boolean }} [opts]
 */
export function applySymbolicSurfaceGuard(reply, opts = {}) {
  const original = typeof reply === 'string' ? reply : '';
  if (!original.trim()) {
    return { reply: original, hits: [], changed: false };
  }

  const hits = [];
  let text = original;

  if (TAXONOMY_LEAK_RE.test(text)) {
    hits.push('taxonomy_leak');
    TAXONOMY_LEAK_RE.lastIndex = 0;
    text = text.replace(TAXONOMY_LEAK_RE, '').replace(/\s{2,}/g, ' ').trim();
  }

  if (DEBUG_TEMPLATE_RE.test(text)) {
    hits.push('debug_template');
    text = text
      .replace(/^Ortak\s+[cç]izgi\s*:\s*/gim, '')
      .replace(/^Ortak\s+tema\s*:\s*/gim, '')
      .replace(/^[OÖ]ne\s+[cç][ıi]kan\s+yap[ıi]\s*:\s*/gim, '')
      .replace(/^major\s+arcana\s+weight\s*:\s*/gim, '');
  }

  if (opts.symbolic !== false && ABSOLUTE_SYMBOLIC_CLAIM_RE.test(text)) {
    hits.push('absolute_symbolic_claim');
    text = text
      .replace(/\bkesin(likle)?\s+seni\s+seviyor\b/gi, 'seni önemsiyor olabilir')
      .replace(/\bkesin(likle)?\s+seni\s+d[uü][sş][uü]n[uü]yor\b/gi, 'seni düşünüyor olabilir')
      .replace(/\bkesin(likle)?\s+geri\s+d[oö]necek\b/gi, 'geri dönme olasılığı var')
      .replace(/\bevrenden\s+kesin\s+mesaj\b/gi, 'tekrarlayan bir tema');
  }

  if (opts.symbolic !== false && UNRELATED_CAPABILITY_RE.test(text)) {
    // Soft flag only — do not invent a new reply here; caller may reject route earlier.
    hits.push('unrelated_capability_token');
  }

  return {
    reply: text,
    hits,
    changed: text !== original,
  };
}

/**
 * Persist primary domain onto conversation state (lightweight).
 * @param {string} conversationId
 * @param {SymbolicDomainId} domain
 */
export function rememberSymbolicDomain(conversationId, domain) {
  if (!domain) return;
  const state = getConversationState(conversationId);
  state.symbolicDomain = domain;
  state.activeTopic = state.activeTopic || domain;
  state.updatedAt = new Date().toISOString();
}

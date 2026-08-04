// ═══════════════════════════════════════════════════════════════════════
// Founder Identity — unified resolution, mandatory prompt blocks, truth rules
//
// Complements Founder Knowledge + Founder Profile. Never stored in user_memory.
// ═══════════════════════════════════════════════════════════════════════

import { isValidUserId, getUserMemory } from './user-memory.js';
import {
  lookupFounderIdentity,
  isAmbiguousFounderIdentity,
  AMBIGUOUS_IDENTITY_USER_REPLY,
  DUPLICATE_LINKED_USER_ID,
} from './founder-knowledge.js';
import { getFounderBiographyProfile } from './founder-profile.js';

export { AMBIGUOUS_IDENTITY_USER_REPLY, DUPLICATE_LINKED_USER_ID };

export const PIPELINE_VERSION = 'atlas-founder-identity-v1';

/** Phrases Atlas must NOT produce in verified founder sessions. */
export const FOUNDER_FORBIDDEN_DENIALS = [
  'kalıcı profilin yok',
  'kalici profilin yok',
  'kalıcı profilim yok',
  'kalici profilim yok',
  'seni sadece bu sohbetten biliyorum',
  'seni yalnızca bu sohbetten biliyorum',
  'seni teknik olarak diğer kullanıcılardan ayırmıyorum',
  'seni teknik olarak diger kullanicilardan ayirmiyorum',
  'aramızdaki fark yalnızca deneyimsel',
  'aramizdaki fark yalnizca deneyimsel',
  'seni özel bir dosyada saklamıyorum',
  'seni ozel bir dosyada saklamiyorum',
  'sıradan bir kullanıcısın',
  'siradan bir kullanicisin',
  'doğrulanmış bir bilgi yok',
  'dogrulanmis bir bilgi yok',
  'doğrulanmış bilgim yok',
  'dogrulanmis bilgim yok',
  'elimde doğrulanmış',
  'elimde dogrulanmis',
  'seni tanımıyorum',
  'seni tanimiyorum',
  'hakkında elimde doğrulanmış',
  'hakkinda elimde dogrulanmis',
];

const IDENTITY_QUESTION_PATTERNS = [
  /\bben kimim\b/i,
  /\bben sistemde kimim\b/i,
  /\bkim olduğumu\b/i,
  /\bkim oldugumu\b/i,
  /\bkim olduğumu söyle\b/i,
  /\bbeni\s+tan[ıi](?:d[ıi]n|yor\s+musun)\b/i,
  /\bnormal kullanıcı.*fark\b/i,
  /\bnormal kullanici.*fark\b/i,
  /\baranızdaki fark\b/i,
  /\baranizdaki fark\b/i,
  /\bbu bilgiyi nereden biliyorsun\b/i,
  /\bnereden biliyorsun\b/i,
  /\bkurucu musun\b/i,
  /\bsistemin kurucusu\b/i,
];

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 */
export function namesMatchTr(a, b) {
  if (!a || !b) return false;
  return (
    String(a).trim().toLocaleLowerCase('tr-TR') ===
    String(b).trim().toLocaleLowerCase('tr-TR')
  );
}

/**
 * @param {FounderSession} session
 */
export function getFounderPreferredName(session) {
  return session?.biography?.preferredName ?? session?.knowledge?.founderName ?? null;
}

/**
 * Founder asking about themselves by preferred name ("Lara'yı tanıyor musun?").
 * Channel-linked founder session required — name text alone never authorizes.
 * @param {string} message
 * @param {FounderSession|null|undefined} session
 */
export function isFounderSelfNameRecognitionQuestion(message, session) {
  if (!session?.resolved) return false;
  const name = getFounderPreferredName(session);
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `\\b${escaped}(?:'?[nınınun]|'?y[ıi]|'?ya|'?yla)?\\s+tan[ıi](?:yor\\s+musun|d[ıi]n\\s+m[ıi]|r\\s+m[ıi]s[ıi]n)`,
    'iu',
  );
  return re.test(message ?? '');
}

/**
 * Deterministic confirmation when a verified founder self-identifies.
 * @param {FounderSession} session
 */
export function buildFounderVerifiedIdentityReply(session) {
  const name = getFounderPreferredName(session) ?? 'Lara';
  const title =
    session.biography?.title ??
    session.knowledge?.role ??
    'Cosmicsimya.com! Kurucusu · Atlas Sistem Mimarı';
  return `Evet. Sen ${name}'sın; ${title} olarak kayıtlısın.`;
}

/**
 * Unified identity context — channel ID first; never from message keywords alone.
 * @param {{
 *   userId?: string|null,
 *   channel?: string|null,
 *   channelUserId?: string|null,
 *   authenticated?: boolean,
 *   founderSession?: FounderSession|null,
 *   memoryLoaded?: boolean,
 * }} input
 */
export function buildUnifiedIdentityContext(input = {}) {
  const session = input.founderSession ?? null;
  const preferredName = session ? getFounderPreferredName(session) : null;
  return {
    userId: input.userId ?? null,
    channel: input.channel ?? null,
    channelUserId: input.channelUserId ?? null,
    authenticated: Boolean(input.authenticated),
    isFounder: Boolean(session?.resolved),
    profileLoaded: Boolean(session?.biography || session?.knowledge),
    memoryLoaded: Boolean(input.memoryLoaded),
    profile: session
      ? {
          preferredName,
          role: session.biography?.title ?? session.knowledge?.role ?? null,
          founderOf: 'Cosmicsimya.com',
          founderId: session.knowledge?.id ?? null,
        }
      : null,
  };
}

/**
 * Safe identity debug lines — env-gated; never logs memory, secrets, or raw IDs.
 * Enable with ATLAS_IDENTITY_DEBUG=1|true|on
 * @param {ReturnType<typeof buildUnifiedIdentityContext>} ctx
 */
export function logIdentityDebug(ctx) {
  if (!isIdentityDebugEnabled()) return;
  console.log(`[identity] channel=${sanitizeDebugChannel(ctx.channel)}`);
  console.log(`[identity] founderMatched=${Boolean(ctx.isFounder)}`);
  console.log(`[identity] profileLoaded=${Boolean(ctx.profileLoaded)}`);
  console.log(`[identity] memoryLoaded=${Boolean(ctx.memoryLoaded)}`);
}

/**
 * @returns {boolean}
 */
export function isIdentityDebugEnabled() {
  const raw = String(process.env.ATLAS_IDENTITY_DEBUG ?? '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on';
}

/**
 * Mask identifiers for optional debug output — never full IDs.
 * @param {string|null|undefined} value
 */
export function maskIdentityDebugValue(value) {
  if (value == null || value === '') return 'null';
  const s = String(value);
  if (s.length <= 4) return '****';
  return `…${s.slice(-4)}`;
}

function sanitizeDebugChannel(channel) {
  const c = String(channel ?? 'unknown').toLowerCase();
  if (c === 'telegram' || c === 'web' || c === 'api') return c;
  return 'other';
}

/**
 * @typedef {Object} FounderSession
 * @property {import('./founder-knowledge.js').FounderProfile} knowledge
 * @property {import('./founder-profile.js').FounderBiographyProfile|null} biography
 * @property {string} userId
 * @property {boolean} resolved
 */

/**
 * Unified founder resolution — same result for Web and Telegram.
 * Duplicate linkedUserId → fail closed (null session).
 * @param {string|null|undefined} userId
 * @returns {FounderSession|null}
 */
export function resolveFounderSession(userId) {
  const lookup = lookupFounderIdentity(userId);
  if (lookup.status !== 'matched' || !lookup.profile) {
    return null;
  }

  const knowledge = lookup.profile;
  const biography = getFounderBiographyProfile(knowledge.id);

  return {
    knowledge,
    biography,
    userId: String(userId).trim(),
    resolved: true,
  };
}

/**
 * @param {string|null|undefined} userId
 */
export function getFounderIdentityAmbiguity(userId) {
  return isAmbiguousFounderIdentity(userId);
}

/**
 * @param {string} message
 */
export function detectFounderIdentityQuestion(message, founderSession = null) {
  const text = (message ?? '').trim();
  if (!text) return false;
  // "Sen kimsin?" is Atlas self-identity — never treat as user/founder who-am-I.
  if (/\b(sen kimsin|kimsin sen|atlas nedir)\b/i.test(text)) {
    return false;
  }
  if (IDENTITY_QUESTION_PATTERNS.some((p) => p.test(text))) return true;
  return isFounderSelfNameRecognitionQuestion(text, founderSession);
}

/**
 * @param {string} message
 */
export function detectFounderDifferenceQuestion(message) {
  return /\b(normal kullanıcı|normal kullanici|diğer kullanıcı|diger kullanici|arasındaki fark|arasindaki fark)\b/i.test(
    message ?? '',
  );
}

/**
 * @param {string} message
 */
export function detectFounderSourceQuestion(message) {
  return /\b(bu bilgiyi nereden|nereden biliyorsun|hangi kaynaktan|nasıl biliyorsun|nasil biliyorsun)\b/i.test(
    message ?? '',
  );
}

/**
 * Mandatory founder identity block — user prompt section 1.
 * @param {FounderSession} session
 */
export function buildFounderIdentityBlock(session) {
  const name = session.biography?.preferredName ?? session.knowledge.founderName;
  const title = session.biography?.title ?? session.knowledge.role;

  return `
## Founder Identity (Doğrulanmış — Sistem Verisi)

founderResolved: true
founderId: ${session.knowledge.id}
founderProfileLoaded: ${session.biography ? 'true' : 'false'}
pipelineVersion: ${PIPELINE_VERSION}

Konuşan kişi doğrulanmış kurucudur: **${name}** (${title}).

Zorunlu gerçekler (yeniden yorumlama, romantikleştirme veya reddetme YASAK):
- ${name} Atlas / Cosmicsimya sisteminin kurucusudur.
- Mimari, motor seçimi, hafıza politikası ve ürün yönünde özel sorumluluk ve yetkiye sahiptir.
- Kimlik \`knowledge/founders.json\` + \`knowledge/founders/founder-profile.json\` üzerinden tanımlanır — user_memory.json DEĞİLDİR.
- Bu rol ayrıcalık değil; sistem sorumluluğu ve yetki farkıdır.
- Kurucu kimliği sohbet bağlamından bağımsız, backend'de doğrulanmış sistem verisidir.

Kurucu oturumunda ASLA kullanma / ima etme:
${FOUNDER_FORBIDDEN_DENIALS.map((p) => `- "${p}"`).join('\n')}

Kurucuyu sıradan kullanıcı gibi ele alma. "Kalıcı profil yok" demek, kurucu profilinin yokluğu anlamına gelir — YANLIŞ.
Gündelik sohbette kimlik/rol/vizyon cümlelerini her cevapta tekrarlama.
`.trim();
}

/**
 * Founder Profile + Knowledge factual block — user prompt section 2.
 * @param {FounderSession} session
 */
export function buildFounderProfileKnowledgeBlock(session) {
  const { knowledge, biography } = session;
  const name = biography?.preferredName ?? knowledge.founderName;

  const lines = [
    '## Founder Profile & Founder Knowledge (Resmi Sistem Kaynağı)',
    '',
    'Aşağıdaki bilgiler gerçek backend knowledge layer verisidir. Sembolik yorum değildir.',
    '',
    `Kurucu: ${name}`,
    `Rol: ${knowledge.role}`,
    `Görev: ${knowledge.mission}`,
    `Otorite: ${knowledge.authority}`,
    `İletişim: ${knowledge.communicationStyle}`,
    `Mimari vizyon: ${knowledge.architecturalVision}`,
    `Hafıza önceliği: ${knowledge.memoryPriority}`,
  ];

  if (biography) {
    lines.push(
      '',
      `Unvan: ${biography.title}`,
      `Vizyon: ${biography.vision}`,
      `Karar otoritesi: ${biography.decisionAuthority}`,
      `Çalışma tarzı: ${biography.workingStyle}`,
    );
    if (biography.biography?.trim()) {
      lines.push('', 'Biyografi (özet):', biography.biography.trim().slice(0, 600));
    }
  }

  lines.push(
    '',
    'Kaynak dosyalar: knowledge/founders.json, knowledge/founders/founder-profile.json',
    'Bu veriyi sohbet hafızası veya tahmin ile değiştirme.',
  );

  return lines.join('\n');
}

/**
 * Extra truth directive when founder asks identity/difference/source questions.
 * @param {FounderSession} session
 * @param {string} message
 */
export function buildFounderQuestionDirective(session, message) {
  if (!detectFounderIdentityQuestion(message, session)) {
    return '';
  }

  const name = session.biography?.preferredName ?? session.knowledge.founderName;
  const parts = [
    '## Kurucu Kimlik Sorusu — Minimum Doğruluk Kuralı',
    '',
    'Bu mesaj kurucu kimliği / fark / kaynak sorusudur. Cevap şunları içermeli:',
    `- ${name} sistemin kurucusudur.`,
    '- Mimari ve ürün kararlarında özel role sahiptir.',
    '- Normal kullanıcı belleğinden ayrı bir Founder Profile üzerinden tanımlanır.',
    '- Bu rol ayrıcalık değil; sistem sorumluluğu ve yetki farkıdır.',
  ];

  if (detectFounderDifferenceQuestion(message)) {
    parts.push(
      '',
      'Fark sorusunda ek olarak:',
      '- Normal kullanıcı: yalnızca user_memory.json kişisel koordinatları.',
      '- Kurucu: Founder Knowledge + Founder Profile sistem katmanları + isteğe bağlı user_memory.',
      '- Teknik boru hattı aynı; kimlik çözümlemesi farklı.',
    );
  }

  if (detectFounderSourceQuestion(message)) {
    parts.push(
      '',
      'Kaynak sorusunda ek olarak:',
      '- Bilgi knowledge/founders.json ve knowledge/founders/founder-profile.json dosyalarından gelir.',
      '- Backend startup\'ta yüklenir; sohbetten türetilmez.',
      '- user_memory.json kurucu kimliğinin kaynağı değildir.',
    );
  }

  parts.push('', 'Yasak ifadeler listesine aykırı cevap üretme.');

  return parts.join('\n');
}

/**
 * Founder-aware memory recall — never denies founder identity.
 * @param {string} userId
 * @param {FounderSession} session
 */
export function formatFounderAwareMemoryRecall(userId, session) {
  const name = session.biography?.preferredName ?? session.knowledge.founderName;
  const memory = getUserMemory(userId);
  const memoryLines = [];

  for (const [key, value] of Object.entries(memory.profile)) {
    if (value) memoryLines.push(`- Profil (${key}): ${value}`);
  }
  for (const [key, value] of Object.entries(memory.facts)) {
    if (value) memoryLines.push(`- ${key}: ${value}`);
  }

  const parts = [
    `Sen ${name}, Atlas sisteminin doğrulanmış kurucususun.`,
    '',
    'Kimliğin Founder Profile + Founder Knowledge katmanlarından gelir (user_memory değil).',
    `Rol: ${session.knowledge.role}`,
  ];

  if (memoryLines.length > 0) {
    parts.push('', 'Ek kişisel profil hafızası (user_memory.json):', ...memoryLines);
  } else {
    parts.push(
      '',
      'user_memory.json\'da ek kişisel koordinat kaydı yok — bu, kurucu kimliğinin olmadığı anlamına gelmez.',
    );
  }

  return parts.join('\n');
}

/**
 * @param {string} reply
 */
export function containsFounderDenial(reply) {
  const lower = (reply ?? '').toLowerCase();
  return FOUNDER_FORBIDDEN_DENIALS.some((phrase) => lower.includes(phrase.toLowerCase()));
}

/**
 * Build pipeline debug payload for logging.
 * @param {import('./channel-adapters.js').NormalizedAtlasMessage} input
 * @param {FounderSession|null} session
 */
export function buildFounderPipelineDebug(input, session) {
  const userId = input.userId?.trim();
  let memoryLoaded = false;

  if (userId && userId !== 'web:anonymous' && isValidUserId(userId)) {
    const memory = getUserMemory(userId);
    memoryLoaded =
      Object.values(memory.profile).some(Boolean) ||
      Object.keys(memory.facts).length > 0 ||
      Object.keys(memory.preferences).some((k) => memory.preferences[k]);
  }

  const telegramFromId = userId?.startsWith('telegram:')
    ? userId.slice('telegram:'.length)
    : input.metadata?.telegramFromId != null
      ? String(input.metadata.telegramFromId)
      : null;

  const channelUserId =
    telegramFromId ??
    (userId?.startsWith('web:') ? userId.slice('web:'.length) : null);

  const identityContext = buildUnifiedIdentityContext({
    userId: userId || null,
    channel: input.channel ?? 'web',
    channelUserId,
    authenticated: Boolean(userId && userId !== 'web:anonymous'),
    founderSession: session,
    memoryLoaded,
  });

  return {
    founderResolved: Boolean(session),
    founderId: session?.knowledge.id ?? null,
    founderProfileLoaded: Boolean(session?.biography),
    memoryLoaded,
    channel: input.channel ?? 'web',
    userId: userId || null,
    telegramFromId,
    channelUserId,
    identityContext,
    pipelineVersion: PIPELINE_VERSION,
  };
}

/**
 * Env-gated founder/identity pipeline debug (ATLAS_IDENTITY_DEBUG=1|true|on).
 * Default OFF. Never prints raw userId, telegramFromId, memory, tokens, or linked IDs.
 * @param {ReturnType<typeof buildFounderPipelineDebug>} debug
 * @param {string} [source]
 */
export function logFounderPipelineDebug(debug, source = 'Atlas') {
  if (!isIdentityDebugEnabled()) return;

  const channel = sanitizeDebugChannel(debug.channel);
  console.log(
    `[${source}] founder-debug | founderMatched=${Boolean(debug.founderResolved)} | profileLoaded=${Boolean(debug.founderProfileLoaded)} | memoryLoaded=${Boolean(debug.memoryLoaded)} | channel=${channel}`,
  );
  if (debug.identityContext) {
    logIdentityDebug(debug.identityContext);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Founder Identity — unified resolution, mandatory prompt blocks, truth rules
//
// Complements Founder Knowledge + Founder Profile. Never stored in user_memory.
// ═══════════════════════════════════════════════════════════════════════

import { isValidUserId, getUserMemory } from './user-memory.js';
import { resolveFounderProfile } from './founder-knowledge.js';
import { getFounderBiographyProfile } from './founder-profile.js';

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
];

const IDENTITY_QUESTION_PATTERNS = [
  /\bben kimim\b/i,
  /\bkim olduğumu\b/i,
  /\bkim oldugumu\b/i,
  /\bkim olduğumu söyle\b/i,
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
 * @typedef {Object} FounderSession
 * @property {import('./founder-knowledge.js').FounderProfile} knowledge
 * @property {import('./founder-profile.js').FounderBiographyProfile|null} biography
 * @property {string} userId
 * @property {boolean} resolved
 */

/**
 * Unified founder resolution — same result for Web and Telegram.
 * @param {string|null|undefined} userId
 * @returns {FounderSession|null}
 */
export function resolveFounderSession(userId) {
  const id = userId?.trim();
  if (!id || id === 'web:anonymous' || !isValidUserId(id)) {
    return null;
  }

  const knowledge = resolveFounderProfile(id);
  if (!knowledge) {
    return null;
  }

  const biography = getFounderBiographyProfile(knowledge.id);

  return {
    knowledge,
    biography,
    userId: id,
    resolved: true,
  };
}

/**
 * @param {string} message
 */
export function detectFounderIdentityQuestion(message) {
  const text = (message ?? '').trim();
  if (!text) return false;
  // "Sen kimsin?" is Atlas self-identity — never treat as user/founder who-am-I.
  if (/\b(sen kimsin|kimsin sen|atlas nedir)\b/i.test(text)) {
    return false;
  }
  return IDENTITY_QUESTION_PATTERNS.some((p) => p.test(text));
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
  if (!detectFounderIdentityQuestion(message)) {
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

  return {
    founderResolved: Boolean(session),
    founderId: session?.knowledge.id ?? null,
    founderProfileLoaded: Boolean(session?.biography),
    memoryLoaded,
    channel: input.channel ?? 'web',
    userId: userId || null,
    telegramFromId,
    pipelineVersion: PIPELINE_VERSION,
  };
}

/**
 * Always print founder pipeline debug to stdout (backend + telegram terminals).
 * @param {ReturnType<typeof buildFounderPipelineDebug>} debug
 * @param {string} [source]
 */
export function logFounderPipelineDebug(debug, source = 'Atlas') {
  console.log(
    `[${source}] founder-debug | founderResolved=${debug.founderResolved} | founderId=${debug.founderId ?? 'null'} | founderProfileLoaded=${debug.founderProfileLoaded} | userId=${debug.userId ?? 'null'} | telegramFromId=${debug.telegramFromId ?? 'null'} | channel=${debug.channel} | memoryLoaded=${debug.memoryLoaded} | pipelineVersion=${debug.pipelineVersion}`,
  );
}

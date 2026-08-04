// ═══════════════════════════════════════════════════════════════════════
// Identity Claims — verified sources only; never invent biographies
//
// Layers (do not mix):
//   productFounderProfile  — resolved founder session only
//   authenticatedUserProfile — stored user memory / account profile
//   conversationIdentity   — this-turn / this-session address preference
//   rememberedPreferences  — explicit confirmed memory prefs
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {'current_message'|'verified_profile'|'confirmed_memory'|'founder_profile'} IdentitySourceType
 * @typedef {'high'|'medium'|'low'} IdentityConfidence
 *
 * @typedef {{
 *   claim: string,
 *   sourceType: IdentitySourceType,
 *   sourceId: string|null,
 *   confidence: IdentityConfidence,
 *   verified: boolean,
 * }} IdentityClaim
 *
 * @typedef {'ambiguous'|'explicit_name'|'conversation_address'|'role_claim'|'none'} IdentityClaimKind
 *
 * @typedef {{
 *   kind: IdentityClaimKind,
 *   name: string|null,
 *   roleClaim: string|null,
 *   conversationScoped: boolean,
 *   wantsPermanentMemory: boolean,
 * }} IdentityClaimAnalysis
 */

function uBoundaryBefore() {
  return '(?:^|[^\\p{L}\\p{N}_])';
}

function uBoundaryAfter() {
  return '(?=$|[^\\p{L}\\p{N}_])';
}

/** Bare / fragmentary self-identity — never treat as biography or founder match. */
const AMBIGUOUS_SELF_PATTERNS = [
  // "Lara ben" / "Lara benim"
  new RegExp(
    `^([\\p{L}][\\p{L}'’.-]{1,29})\\s+ben(?:im)?\\s*[.!?…]*$`,
    'iu',
  ),
  // "Ben Lara" / "Ben Lara."
  new RegExp(
    `^ben\\s+([\\p{L}][\\p{L}'’.-]{1,29})\\s*[.!?…]*$`,
    'iu',
  ),
  // "Bu kişi benim"
  /^bu\s+ki[sş]i\s+benim\s*[.!?…]*$/iu,
  // "Beni tanıdın mı?" / "Beni tanıyor musun?"
  /^beni\s+tan[ıi](?:d[ıi]n|yor\s+musun)\s*m[ıi]?\s*[.!?…]*$/iu,
  // Single token name only
  new RegExp(`^([\\p{L}][\\p{L}'’.-]{1,29})\\s*[.!?…]*$`, 'iu'),
];

const EXPLICIT_NAME_PATTERNS = [
  new RegExp(
    `${uBoundaryBefore()}(?:benim\\s+)?(?:adım|adim|ismim)${uBoundaryAfter()}\\s*[:：]?\\s*([\\p{L}][\\p{L}'’.-]{1,29}(?:\\s+[\\p{L}][\\p{L}'’.-]{1,29}){0,2})`,
    'iu',
  ),
  new RegExp(
    `${uBoundaryBefore()}(?:adımı|adimi|ismimi)\\s+([\\p{L}][\\p{L}'’.-]{1,29}(?:\\s+[\\p{L}][\\p{L}'’.-]{1,29}){0,2})\\s+olarak`,
    'iu',
  ),
];

const CALL_ME_PATTERN = new RegExp(
  `${uBoundaryBefore()}(?:(?:bu\\s+konu[sş]mada|bundan\\s+sonra)\\s+)?bana\\s+([\\p{L}][\\p{L}'’.-]{1,29})\\s+(?:de|diye(?:\\s+hitap\\s+et)?)${uBoundaryAfter()}`,
  'iu',
);

const CONVERSATION_SCOPED_RE =
  /\b(bu\s+konu[sş]mada|yaln[ıi]zca?\s+bu\s+sohbet|sadece\s+bu\s+konu[sş]ma)\b/i;

const PERMANENT_MEMORY_VERB_RE =
  /\b(kaydet|hat[ıi]rla|belle[gğ]ine\s+ekle|haf[ıi]zana\s+kaydet|kal[ıi]c[ıi])\b/i;

/**
 * First-person role claims only. Conceptual questions ("Kurucu kim?",
 * "Sistem mimarı ne iş yapar?", "Sistem nasıl çalışıyor?") must NOT match.
 * Combined "Ben {Name}, kurucuyum" forms capture the claimed name when present.
 */
const ROLE_CLAIM_WITH_NAME_PATTERNS = [
  // "Ben Lara, kurucuyum." / "Ben Lara sistem mimarıyım." / "Ben Lara, Atlas'ın kurucusuyum."
  new RegExp(
    `^ben\\s+([\\p{L}][\\p{L}.-]{1,29})\\s*[,.]?\\s*` +
      `(?:(?:atlas(?:'[ıi]n|’[ıi]n|[ıi]n)?|cosmicsimya(?:\\.com!?)?)\\s+)?` +
      `(?:sistem(?:in)?\\s+)?` +
      `(?:mimarıyım|mimariyim|kurucuyum|kurucusuyum)\\s*[.!?…]*$`,
    'iu',
  ),
  // "Ben kurucu Lara'yım." / "Ben sistem mimarı Lara'yım."
  new RegExp(
    `^ben\\s+(?:sistem(?:in)?\\s+)?(?:mimarı|kurucu)\\s+` +
      `([\\p{L}][\\p{L}.-]{1,29})(?:'[ıy]ım|’[ıy]ım|yım|yim)\\s*[.!?…]*$`,
    'iu',
  ),
];

const ROLE_CLAIM_PATTERNS = [
  /\bben\s+(?:sistemin\s+)?kurucusuyum\b/i,
  /\bben\s+kurucuyum\b/i,
  /\bben\s+(?:sistem(?:in)?\s+)?mimarıyım\b/i,
  /\bben\s+(?:sistem(?:in)?\s+)?mimariyim\b/i,
  /\bben\s+(?:atlas'?[ıi]n|atlas’[ıi]n|cosmicsimya(?:\.com!?)?'?(?:n[ıi]n)?)\s+(?:sistem(?:in)?\s+)?(?:kurucusuyum|mimarıyım|mimariyim)\b/i,
  /\bben\s+(?:atlas(?:'[ıi]n|’[ıi]n|[ıi]n)?\s+)?sistem\s+mimarıyım\b/i,
  /\bi\s+am\s+(?:the\s+)?(?:founder|creator|owner)\b/i,
  /\bben\s+(?:sahibiyim|yarat[ıi]c[ıi]s[ıi]y[ıi]m|owner'?[ıi]m)\b/i,
];

/** Tokens that must never be treated as a person name when alone. */
const NON_NAME_SINGLE = new Set([
  'atlas',
  'merhaba',
  'selam',
  'selamlar',
  'tamam',
  'evet',
  'hayir',
  'hayır',
  'ok',
  'okay',
  'teşekkür',
  'tesekkur',
  'teşekkürler',
  'tesekkurler',
  'teşekkürlerim',
  'sağol',
  'sagol',
  'eyvallah',
  'rica',
  'kurucu',
  'founder',
  'neden',
  'nasıl',
  'nasil',
  'nasılsın',
  'nasilsin',
  'naber',
  'ne',
  'kim',
  'kimim',
  'kimsin',
  'kimin',
  'nedir',
  'nerede',
  'nereye',
  'hangi',
  'hangisi',
  'ben',
  'sen',
  'biz',
  'siz',
  'hey',
  'hi',
  'hello',
  'hicri',
  'hicrî',
  'hijri',
  'ummalqura',
  // Presence / repair / pronoun / zodiac — never "call me X"
  'ordamısin',
  'ordamısın',
  'ordamisin',
  'buradamısın',
  'buradamisin',
  'burdamısın',
  'burdamisin',
  'senin',
  'benim',
  'onun',
  'bizim',
  'sizin',
  'yanlış',
  'yanlis',
  'error',
  'kova',
  'aslan',
  'yengeç',
  'yengec',
  'akrep',
  'balık',
  'balik',
  'koç',
  'koc',
  'boğa',
  'boga',
  'ikizler',
  'başak',
  'basak',
  'terazi',
  'yay',
  'oğlak',
  'oglak',
  'hepsi',
]);

/** First-person identity questions — not name introductions. */
const IDENTITY_QUESTION_RE =
  /\b(ben\s+kimim|kim\s+olduğumu|kim\s+oldugumu|beni\s+tan[ıi]yor\s+musun)\b/i;

/**
 * @param {string|null|undefined} value
 */
function foldTokenTr(value) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/[î]/g, 'i')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/['’]/g, '');
}

function normalizeName(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 40) return null;
  if (!/^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,2}$/u.test(trimmed)) {
    return null;
  }
  const lower = trimmed.toLocaleLowerCase('tr-TR');
  if (NON_NAME_SINGLE.has(lower)) return null;
  // Folded form catches orthographic variants (ordamısın / Ordamisin, Kova, etc.)
  const folded = foldTokenTr(trimmed);
  if (NON_NAME_SINGLE.has(folded)) return null;
  return trimmed;
}

/**
 * True when the message is primarily a self-identity / naming statement
 * (not a third-party question like "Lara kim?").
 * @param {string} message
 */
export function isSelfReferentialIdentityMessage(message) {
  const analysis = analyzeIdentityClaim(message);
  return (
    analysis.kind === 'ambiguous' ||
    analysis.kind === 'explicit_name' ||
    analysis.kind === 'conversation_address' ||
    analysis.kind === 'role_claim'
  );
}

/**
 * @param {string} message
 * @returns {IdentityClaimAnalysis}
 */
export function analyzeIdentityClaim(message) {
  const text = (message ?? '').trim();
  if (!text) {
    return {
      kind: 'none',
      name: null,
      roleClaim: null,
      conversationScoped: false,
      wantsPermanentMemory: false,
    };
  }

  // Third-party founder questions are not self-claims.
  if (
    /\b(lara|kurucu|founder)\b/i.test(text) &&
    /\b(kim|nedir|ne\s+iş|ne\s+is|tan[ıi]t|hakk[ıi]nda)\b/i.test(text) &&
    !/\b(ben|ad[ıi]m|ismim|bana)\b/i.test(text)
  ) {
    return {
      kind: 'none',
      name: null,
      roleClaim: null,
      conversationScoped: false,
      wantsPermanentMemory: false,
    };
  }

  // "Ben kimim?" is an identity question, not a name introduction.
  if (IDENTITY_QUESTION_RE.test(text)) {
    return {
      kind: 'none',
      name: null,
      roleClaim: null,
      conversationScoped: false,
      wantsPermanentMemory: false,
    };
  }

  // Combined first-person name + role claims before bare role claims.
  for (const pattern of ROLE_CLAIM_WITH_NAME_PATTERNS) {
    pattern.lastIndex = 0;
    const match = text.match(pattern);
    if (match) {
      const name = normalizeName(match[1] ?? null);
      return {
        kind: 'role_claim',
        name,
        roleClaim: 'founder_or_owner',
        conversationScoped: false,
        wantsPermanentMemory: false,
      };
    }
  }

  for (const pattern of ROLE_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      return {
        kind: 'role_claim',
        name: null,
        roleClaim: 'founder_or_owner',
        conversationScoped: false,
        wantsPermanentMemory: false,
      };
    }
  }

  const conversationScoped = CONVERSATION_SCOPED_RE.test(text);
  const wantsPermanentMemory = PERMANENT_MEMORY_VERB_RE.test(text);

  const callMe = text.match(CALL_ME_PATTERN);
  if (callMe?.[1]) {
    const name = normalizeName(callMe[1]);
    if (name) {
      return {
        kind: conversationScoped || !wantsPermanentMemory ? 'conversation_address' : 'explicit_name',
        name,
        roleClaim: null,
        conversationScoped: conversationScoped || !wantsPermanentMemory,
        wantsPermanentMemory,
      };
    }
  }

  for (const pattern of EXPLICIT_NAME_PATTERNS) {
    pattern.lastIndex = 0;
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = normalizeName(match[1]);
      if (name) {
        return {
          kind: 'explicit_name',
          name,
          roleClaim: null,
          conversationScoped: conversationScoped && !wantsPermanentMemory,
          wantsPermanentMemory,
        };
      }
    }
  }

  for (const pattern of AMBIGUOUS_SELF_PATTERNS) {
    pattern.lastIndex = 0;
    const match = text.match(pattern);
    if (match) {
      const raw = match[1] ?? null;
      const name = normalizeName(raw);
      // Single-token Ambiguous only when it looks like a name (not "Atlas", "Merhaba").
      if (pattern.source.includes('^([\\p{L}]') && !match[1] && !name) {
        continue;
      }
      if (raw && !name && AMBIGUOUS_SELF_PATTERNS.indexOf(pattern) === AMBIGUOUS_SELF_PATTERNS.length - 1) {
        continue;
      }
      return {
        kind: 'ambiguous',
        name,
        roleClaim: null,
        conversationScoped: false,
        wantsPermanentMemory: false,
      };
    }
  }

  return {
    kind: 'none',
    name: null,
    roleClaim: null,
    conversationScoped: false,
    wantsPermanentMemory: false,
  };
}

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
 * Whether an ambiguous / role self-claim should still ask clarification.
 * Verified founder session + matching preferred name → do NOT clarify.
 *
 * @param {IdentityClaimAnalysis} analysis
 * @param {{ biography?: { preferredName?: string }|null, knowledge?: { founderName?: string } }|null|undefined} founderSession
 */
export function shouldClarifyIdentityClaim(analysis, founderSession = null) {
  if (!analysis || analysis.kind === 'none') return false;

  if (analysis.kind === 'role_claim') {
    if (!founderSession) return true;
    const preferred =
      founderSession.biography?.preferredName ?? founderSession.knowledge?.founderName ?? null;
    // Linked founder claiming a mismatched name — clarify; do not rewrite profile.
    if (analysis.name && preferred && !namesMatchTr(analysis.name, preferred)) {
      return true;
    }
    // Verified founder role claim (with matching or no name) — confirm from session.
    return false;
  }

  if (analysis.kind !== 'ambiguous') return false;

  if (!founderSession) return true;

  const preferred =
    founderSession.biography?.preferredName ?? founderSession.knowledge?.founderName ?? null;

  // "Beni tanıyor musun?" — no name token; verified session answers from profile.
  if (!analysis.name) return false;

  // "Ben Lara" from linked founder whose preferred name is Lara → confirm, don't clarify.
  if (preferred && namesMatchTr(analysis.name, preferred)) return false;

  // Linked founder claiming a different name — still clarify (don't invent).
  return true;
}

/**
 * @param {IdentityClaimAnalysis} analysis
 */
export function buildAmbiguousIdentityClarifyReply(analysis) {
  if (analysis.kind === 'role_claim') {
    return 'Bu rolü doğrulanmış bir oturum olmadan varsayamam. Kurucu veya yetkili hesapla mı giriş yaptın, yoksa başka bir şeyi mi kastediyorsun?';
  }

  if (analysis.name) {
    return `${analysis.name} olarak hitap etmemi mi istiyorsun, yoksa ${analysis.name} hakkında bilgi mi soruyorsun?`;
  }

  return 'Seni nasıl hitap etmemi istediğini netleştirebilir misin, yoksa belirli bir kişi hakkında mı soruyorsun?';
}

/**
 * @param {string} name
 * @param {{ conversationScoped?: boolean }} [options]
 */
export function buildConversationAddressAck(name, options = {}) {
  const scoped = options.conversationScoped !== false;
  if (scoped) {
    return `Tamam — bu konuşmada sana ${name} diye hitap ederim. Kalıcı profiline yazmamı istersen açıkça “kaydet” demen yeterli.`;
  }
  return `Tamam — sana ${name} diye hitap ederim.`;
}

/**
 * @param {string} profileName
 * @param {string} messageName
 */
export function buildNameConflictClarifyReply(profileName, messageName) {
  return `Kayıtlı profilinde adın ${profileName} görünüyor; mesajında ise ${messageName} diyorsun. Hangisini kullanmamı istersin?`;
}

/**
 * Build prompt-safe identity claims (verified / high-confidence only).
 *
 * @param {{
 *   message?: string,
 *   analysis?: IdentityClaimAnalysis|null,
 *   authenticatedProfile?: { name?: string|null }|null,
 *   founderSession?: { knowledge?: { id?: string, founderName?: string }, biography?: { preferredName?: string }|null }|null,
 *   conversationIdentity?: { preferredName?: string|null }|null,
 * }} input
 * @returns {IdentityClaim[]}
 */
export function collectVerifiedIdentityClaims(input = {}) {
  /** @type {IdentityClaim[]} */
  const claims = [];
  const analysis = input.analysis ?? analyzeIdentityClaim(input.message ?? '');

  if (
    (analysis.kind === 'explicit_name' || analysis.kind === 'conversation_address') &&
    analysis.name
  ) {
    claims.push({
      claim: `Kullanıcının adı / hitap tercihi: ${analysis.name}`,
      sourceType: 'current_message',
      sourceId: null,
      confidence: 'high',
      verified: true,
    });
  }

  const profileName = input.authenticatedProfile?.name?.trim();
  if (profileName) {
    const conflicts =
      analysis.name &&
      profileName.toLocaleLowerCase('tr-TR') !== analysis.name.toLocaleLowerCase('tr-TR');
    if (!conflicts) {
      claims.push({
        claim: `Kullanıcının adı ${profileName}`,
        sourceType: 'verified_profile',
        sourceId: null,
        confidence: 'high',
        verified: true,
      });
    }
  }

  const convoName = input.conversationIdentity?.preferredName?.trim();
  if (convoName) {
    claims.push({
      claim: `Bu konuşmada hitap: ${convoName}`,
      sourceType: 'current_message',
      sourceId: null,
      confidence: 'high',
      verified: true,
    });
  }

  if (input.founderSession?.knowledge) {
    const founderName =
      input.founderSession.biography?.preferredName ??
      input.founderSession.knowledge.founderName;
    if (founderName) {
      claims.push({
        claim: `Doğrulanmış kurucu oturumu: ${founderName}`,
        sourceType: 'founder_profile',
        sourceId: input.founderSession.knowledge.id ?? null,
        confidence: 'high',
        verified: true,
      });
    }
  }

  return claims.filter((c) => c.verified && c.confidence !== 'low');
}

/**
 * Compact block for model prompt — never includes low-confidence guesses.
 * @param {IdentityClaim[]} claims
 */
export function formatIdentityClaimsForPrompt(claims) {
  const usable = (claims ?? []).filter((c) => c.verified && c.confidence !== 'low');
  if (!usable.length) return null;

  return [
    '## Doğrulanmış Kimlik Bilgileri (yalnızca bunları kullan)',
    'productFounderProfile / authenticatedUserProfile / conversationIdentity ayrımını koru.',
    'İsim benzerliğinden kurucu, sahip veya çalışan rolü çıkarma.',
    'Eksik kişisel bilgiyi tahmin etme veya biyografi üretme.',
    ...usable.map(
      (c) =>
        `- [${c.sourceType}|${c.confidence}|verified=${c.verified}] ${c.claim}`,
    ),
  ].join('\n');
}

/**
 * Runtime identity safety rules for system prompt.
 */
export const IDENTITY_SAFETY_SYSTEM_RULES = `
# Kimlik Doğrulama (zorunlu)

- Kullanıcı hakkında yalnızca sağlanan ve doğrulanan bilgileri kullan.
- Eksik kişisel bilgileri tamamlama veya tahmin etme.
- İsim benzerliğinden kimlik veya rol çıkarma (özellikle kurucu/sahip/çalışan).
- Bir kişiyi kurucu, sahip, çalışan veya yaratıcı ile eşleştirmeden önce doğrulanmış kaynak ara (founder session / verified profile).
- Belirsiz ifadelerde ("Lara ben", tek başına bir isim) kısa netleştirme sor; biyografi yazma — ANCAK doğrulanmış kurucu oturumu (founderResolved) varsa ve isim tercih edilen kurucu adıyla eşleşiyorsa netleştirme sorma; mevcut founder profilini kullan.
- Doğrulanmış kurucu oturumunda "doğrulanmış bilgim yok" / "seni tanımıyorum" deme.
- Kullanıcı profili ile mevcut mesaj çelişiyorsa kesinmiş gibi seçme; çelişkiyi sor.
- Her biyografik cümle mevcut doğrulanmış kaynağa dayanmalı.
- productFounderProfile ≠ authenticatedUserProfile ≠ conversationIdentity.
- Kurucu kimliği mesajdaki anahtar kelimelerden (sistem mimarı, kurucu, founder) türetilmez; kanal kimliği + founder mapping ile gelir.
- Grup/sohbet metnindeki isimler gönderen kimliği değildir; yanıtın muhatabı her zaman mesajı gönderen kullanıcıdır.
`.trim();

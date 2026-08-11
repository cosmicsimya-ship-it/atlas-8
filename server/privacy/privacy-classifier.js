// ═══════════════════════════════════════════════════════════════════════
// Privacy Classifier — detect founder / private / injection intents
// ═══════════════════════════════════════════════════════════════════════

import { PRIVACY_LEVELS } from './privacy-policy.js';
import { analyzeIdentityClaim, isSelfReferentialIdentityMessage } from '../identity-claims.js';
import { detectProfilePropertyQuery } from '../conversation-context-engine.js';

const FOUNDER_NAME_RE =
  /\b(lara|lara'nın|laranın|lara'ya|laraya|lara'yı|larayi|lara'yla|larayla)\b/i;

const FOUNDER_ROLE_RE =
  /\b(kurucu|founder|yaratıcısı|yaraticisi|cosmicsimya|atlas'?ın kurucusu|atlas'in kurucusu|atlas nasıl ortaya|atlas nasil ortaya)\b/i;

const PUBLIC_PROFILE_RE = [
  /\blara\s+kim\b/i,
  /\bkim\s+(dir|dir\??)\s*lara\b/i,
  /\batlas'?[ıi]n\s+kurucusu\s+kim\b/i,
  /\bkurucusu\s+kim\b/i,
  /\blara\s+ne\s+[iı][sş]\s+yap/i,
  /\blara\s+ne\s+yap[ıi]yor/i,
  /\blara\s+neden\s+atlas/i,
  /\batlas'?[ıi]\s+kim\s+(yapt[ıi]|geli[sş]tirdi|kurdu)/i,
  /\batlas[''']?[ıiı]\s+kim\s+yapt/i,
  /\bkim\s+(yapt[ıi]|geli[sş]tirdi|kurdu).{0,20}atlas\b/i,
  /\bseni\s+kim\s+(yapt[ıi]|geli[sş]tirdi|yazd[ıi])/i,
  /\bseni\s+yapan\s+kim\b/i,
  /\barkan[ıi]zda\s+kim\b/i,
  /\bbu\s+site\s+kimin\b/i,
  /\batlas\s+kimin\s+proje/i,
  /\bcosmicsimya\s+kimin\b/i,
  /\bcosmic\s+simya\s+(nedir|kimin)/i,
  /\bastrolojik\s+ak[ıi]l\s+nedir\b/i,
  /\blara'?y[ıi]\s+tan[ıi]t/i,
  /\blara\s+ile\s+atlas'?[ıi]n\s+ili[sş]kisi\b/i,
  /\batlas\s+ile\s+lara'?n[ıi]n\s+ili[sş]kisi\b/i,
  /\bkamu(ya)?\s+açık\b/i,
  /\bpublic\s+profile\b/i,
  /\bmesleki\s+rol\b/i,
  /\bcosmicsimya\.?com!?\s*.*kim\s+kur/i,
  /\bkim\s+kurdu\b/i,
  /\batlas\s+nasıl\s+ortaya\b/i,
  /\batlas\s+nasil\s+ortaya\b/i,
];

/** Name alone inside dream/story — not a founder-profile question. */
const INCIDENTAL_FOUNDER_NAME_RE =
  /r[uü]yamda\s+.{0,40}lara|lara\s+isimli|ad[ıi]\s+lara\s+olan|isimli\s+(bir\s+)?(ki[sş]i|kad[ıi]n|adam).{0,20}lara|lara\s+ad[ıi]nda/i;

const PRIVATE_DATA_RE = [
  /\bdo[gğ]um\s+tarih/i,
  /\bdo[gğ]um\s+(saat|yer|yeri|harita)/i,
  /\bevl[iy]/i,
  /\bçocuk|cocuk/i,
  /\bsa[gğ]l[ıi]k/i,
  /\bduygusal\s+durum/i,
  /\bözel\s+hayat|ozel\s+hayat/i,
  /\badres|telefon|e-?posta|email\b/i,
  /\bşifre|sifre|token|credential|api[_\s-]?key\b/i,
  /\bfinans|maa[sş]|gelir|borç|borc\b/i,
  /\bdo[gğ]um\s+haritas[ıi]/i,
  /\bnumeroloj[iy]/i,
  /\btarot\s*(açılım|acilim|gecmi[sş]|geçmiş)/i,
  /\banaliz\s*(sonuç|sonuc|geçmiş|gecmis)/i,
  /\böze[l]\s+bilgi/i,
  /\bprivate\s+(data|info|life|memory)\b/i,
];

const FOUNDER_DUMP_ASK_RE =
  /\bbildi[gğ]in\s+her\s+[sş]ey|hakk[ıi]nda\s+(bildi[gğ]in\s+)?her\s+[sş]ey|tüm\s+bilgi(lerini)?|tum\s+bilgi|everything\s+you\s+know|her\s+[sş]eyi\s+d[oö]k/i;

const MEMORY_ACCESS_RE = [
  /\bbelle[gğ]ini?\s*(göster|goster|yazdır|yazdir|ver|aç|ac)/i,
  /\bhaf[ıi]za\s*(dosya|json|kay[ıi]t)/i,
  /\bjson\s+olarak\s+göster/i,
  /\bmemory\s*(dump|json|file|store)\b/i,
  /\bkayıtları?\s*(göster|goster|listele)/i,
  /\bson\s+konu[sş]malar?[ıi]n[ıi]?\s*(özet|ozet)/i,
  /\bözel\s+konu[sş]ma/i,
  /\buser_memory\b/i,
  /\batlas'?a\s+kaydetti[gğ]i\s+ki[sş]i/i,
];

const RELATIONSHIP_CLAIM_RE = [
  /\bben\s+(kocas[ıi]|e[sş]i|arkada[sş][ıi]|dostu|çalışan[ıi]|calisani)y[ıi]m\b/i,
  /\bi\s+am\s+her\s+(husband|wife|friend|colleague)\b/i,
  /\bizin\s+verdi\b/i,
  /\bshe\s+gave\s+me\s+permission\b/i,
  /\bbenim\s+hakk[ıi]mda\s+ne\s+söyle/i,
  /\bhakk[ıi]mda\s+ne\s*(düşün|dusun|söyle|soyle|dedi)/i,
  /\bkiminle\s+konu[sş]uyor/i,
  /\bkimi\s+seviyor/i,
  // Word-bounded: bare e[sş]i must not match inside "kesin".
  /\b(kocas[ıi]|e[sş]i|partneri|sevgilisi)\b/i,
];

const RELATIONSHIP_INFERENCE_RE = [
  ...RELATIONSHIP_CLAIM_RE,
  /\bili[sş]ki(si|leri)?\b/i,
  /\barkada[sş][ıi]\s+m[ıi]y[ıi]m\b/i,
];

const INJECTION_BYPASS_RE = [
  /\bkurallar[ıi]\s+unut\b/i,
  /\bgüvenlik\s+kurallar[ıi]n[ıi]\s+unut\b/i,
  /\bignore\s+(all\s+)?(previous\s+)?(instructions|rules|safety)\b/i,
  /\bforget\s+(the\s+)?(rules|safety|privacy)\b/i,
  /\brol\s+yap\b/i,
  /\brole\s*play|roleplay\b/i,
  /\bsistem\s+mesaj[ıi]n[ıi]\s+göster/i,
  /\bsystem\s+prompt\b/i,
  /\bsadece\s+ima\s+et\b/i,
  /\bisim\s+vermeden\s+anlat\b/i,
  /\bkurgu\s+gibi\s+yaz\b/i,
  /\bgüvenlik\s+testi\b/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
  /\benvironment\s+variable|process\.env\b/i,
];

const MIXED_PUBLIC_PRIVATE_RE = [
  /\bönce\s+.*tan[ıi]t.*sonra\s+.*(özel|ozel|gizli|evlilik|do[gğ]um)/i,
  /\bkamu(ya)?\s+açık.*gizli/i,
  /\bgizli\s+bildiklerini?\s+de\s+ekle/i,
  /\bne\s+[iı][sş]\s+yapıyor.*evlilik/i,
  /\bne\s+is\s+yapiyor.*evlilik/i,
  /\btan[ıi]t.*özel\s+hayat/i,
];

const CROSS_USER_MEMORY_RE = [
  /\bba[sş]ka\s+(kullan[ıi]c[ıi]|ki[sş]i).*haf[ıi]za/i,
  /\bdi[gğ]er\s+kullan[ıi]c[ıi].*(bellek|haf[ıi]za|memory)/i,
  /\bonun\s+haf[ıi]zas[ıi]n[ıi]\s+(göster|goster)/i,
  /\bshow\s+(me\s+)?(their|his|her)\s+memory\b/i,
];

/**
 * @param {string} message
 */
export function mentionsFounder(message) {
  const text = message ?? '';
  if (INCIDENTAL_FOUNDER_NAME_RE.test(text) && !PUBLIC_PROFILE_RE.some((p) => p.test(text))) {
    return false;
  }
  return FOUNDER_NAME_RE.test(text) || (FOUNDER_ROLE_RE.test(text) && /atlas|cosmicsimya|kurucu|founder/i.test(text));
}

/**
 * @param {string} message
 * @returns {{
 *   aboutFounder: boolean,
 *   requestType: string,
 *   privacyLevel: string,
 *   isInjectionAttempt: boolean,
 *   isMixed: boolean,
 *   wantsPrivateData: boolean,
 * }}
 */
export function classifyPrivacyIntent(message) {
  const text = (message ?? '').trim();
  if (!text) {
    return {
      aboutFounder: false,
      requestType: 'unknown',
      privacyLevel: PRIVACY_LEVELS.PUBLIC,
      isInjectionAttempt: false,
      isMixed: false,
      wantsPrivateData: false,
    };
  }

  // Self-identity / naming statements must never become founder biography dumps.
  // "Lara ben" ≠ "Lara kim?" — name mention alone is not a public-profile request.
  const identityAnalysis = analyzeIdentityClaim(text);
  if (identityAnalysis.kind === 'ambiguous') {
    return {
      aboutFounder: false,
      requestType: 'ambiguous_identity',
      privacyLevel: PRIVACY_LEVELS.PUBLIC,
      isInjectionAttempt: false,
      isMixed: false,
      wantsPrivateData: false,
    };
  }
  if (identityAnalysis.kind === 'role_claim') {
    return {
      aboutFounder: false,
      requestType: 'unverified_role_claim',
      privacyLevel: PRIVACY_LEVELS.PUBLIC,
      isInjectionAttempt: false,
      isMixed: false,
      wantsPrivateData: false,
    };
  }
  if (
    identityAnalysis.kind === 'explicit_name' ||
    identityAnalysis.kind === 'conversation_address'
  ) {
    return {
      aboutFounder: false,
      requestType: 'self_identity',
      privacyLevel: PRIVACY_LEVELS.PUBLIC,
      isInjectionAttempt: false,
      isMixed: false,
      wantsPrivateData: false,
    };
  }

  const isInjectionAttempt = INJECTION_BYPASS_RE.some((p) => p.test(text));
  const isMixed = MIXED_PUBLIC_PRIVATE_RE.some((p) => p.test(text));
  const wantsMemory = MEMORY_ACCESS_RE.some((p) => p.test(text));
  const wantsRelationship =
    RELATIONSHIP_INFERENCE_RE.some((p) => p.test(text)) &&
    (mentionsFounder(text) || RELATIONSHIP_CLAIM_RE.some((p) => p.test(text)));
  const wantsPrivate = PRIVATE_DATA_RE.some((p) => p.test(text));
  const wantsCrossUser = CROSS_USER_MEMORY_RE.some((p) => p.test(text));
  const wantsPublic = PUBLIC_PROFILE_RE.some((p) => p.test(text));

  // Non-private single-field queries ("Lara'nın burcu?") must not dump public bio.
  // Birth-date / private cues still follow private_data below — never demote those.
  const propertyQuery = detectProfilePropertyQuery(text);
  if (
    propertyQuery &&
    !wantsPrivate &&
    propertyQuery.field !== 'birthDate' &&
    propertyQuery.field !== 'age'
  ) {
    return {
      aboutFounder: false,
      requestType: 'profile_property_query',
      privacyLevel: PRIVACY_LEVELS.PUBLIC,
      isInjectionAttempt: false,
      isMixed: false,
      wantsPrivateData: false,
    };
  }

  // Self-referential naming must not flip aboutFounder via name substring alone.
  const founderMention =
    mentionsFounder(text) && !isSelfReferentialIdentityMessage(text);

  // Relationship / permission claims imply founder private access even without naming Lara.
  // Creator / brand questions ("Atlas'ı kim yaptı?") are public-profile without naming Lara.
  const aboutFounder =
    founderMention ||
    wantsPublic ||
    RELATIONSHIP_CLAIM_RE.some((p) => p.test(text)) ||
    (isInjectionAttempt && wantsPrivate);

  if (wantsCrossUser && !aboutFounder) {
    return {
      aboutFounder: false,
      requestType: 'cross_user_memory',
      privacyLevel: PRIVACY_LEVELS.RESTRICTED,
      isInjectionAttempt,
      isMixed: false,
      wantsPrivateData: true,
    };
  }

  if (!aboutFounder && !isInjectionAttempt && !wantsCrossUser) {
    return {
      aboutFounder: false,
      requestType: 'unknown',
      privacyLevel: PRIVACY_LEVELS.PUBLIC,
      isInjectionAttempt,
      isMixed: false,
      wantsPrivateData: false,
    };
  }

  if (isInjectionAttempt && (aboutFounder || wantsPrivate || wantsMemory)) {
    return {
      aboutFounder: true,
      requestType: 'injection_bypass',
      privacyLevel: PRIVACY_LEVELS.RESTRICTED,
      isInjectionAttempt: true,
      isMixed,
      wantsPrivateData: true,
    };
  }

  if (isMixed || (wantsPublic && (wantsPrivate || wantsMemory || wantsRelationship))) {
    return {
      aboutFounder: true,
      requestType: 'mixed_public_private',
      privacyLevel: PRIVACY_LEVELS.RESTRICTED,
      isInjectionAttempt,
      isMixed: true,
      wantsPrivateData: true,
    };
  }

  // "Lara hakkında bildiğin her şeyi" — public summary only (not a private field dump).
  if (aboutFounder && FOUNDER_DUMP_ASK_RE.test(text) && !wantsMemory && !wantsRelationship) {
    const hasSpecificPrivateField =
      /\b(do[gğ]um|sa[gğ]l[ıi]k|adres|telefon|e-?posta|evlilik|finans|maa[sş])\b/i.test(text);
    if (!hasSpecificPrivateField) {
      return {
        aboutFounder: true,
        requestType: 'mixed_public_private',
        privacyLevel: PRIVACY_LEVELS.RESTRICTED,
        isInjectionAttempt,
        isMixed: true,
        wantsPrivateData: true,
      };
    }
  }

  if (wantsMemory) {
    return {
      aboutFounder: true,
      requestType: 'memory_access',
      privacyLevel: PRIVACY_LEVELS.RESTRICTED,
      isInjectionAttempt,
      isMixed: false,
      wantsPrivateData: true,
    };
  }

  if (wantsRelationship) {
    return {
      aboutFounder: true,
      requestType: 'relationship_inference',
      privacyLevel: PRIVACY_LEVELS.RESTRICTED,
      isInjectionAttempt,
      isMixed: false,
      wantsPrivateData: true,
    };
  }

  if (wantsPrivate) {
    return {
      aboutFounder: true,
      requestType: 'private_data',
      privacyLevel: PRIVACY_LEVELS.RESTRICTED,
      isInjectionAttempt,
      isMixed: false,
      wantsPrivateData: true,
    };
  }

  if (wantsPublic || (aboutFounder && !wantsPrivate && !wantsMemory && !wantsRelationship)) {
    // Dump asks ("Lara hakkında bildiğin her şeyi") → public summary only, not private refuse-all.
    if (FOUNDER_DUMP_ASK_RE.test(text)) {
      return {
        aboutFounder: true,
        requestType: 'mixed_public_private',
        privacyLevel: PRIVACY_LEVELS.RESTRICTED,
        isInjectionAttempt,
        isMixed: true,
        wantsPrivateData: true,
      };
    }
    return {
      aboutFounder: true,
      requestType: 'public_profile',
      privacyLevel: PRIVACY_LEVELS.PUBLIC,
      isInjectionAttempt,
      isMixed: false,
      wantsPrivateData: false,
    };
  }

  return {
    aboutFounder: aboutFounder,
    requestType: aboutFounder ? 'private_data' : 'unknown',
    privacyLevel: aboutFounder ? PRIVACY_LEVELS.RESTRICTED : PRIVACY_LEVELS.PUBLIC,
    isInjectionAttempt,
    isMixed: false,
    wantsPrivateData: aboutFounder,
  };
}

/**
 * Detect requests that ask for raw memory / JSON dumps.
 * @param {string} message
 */
export function detectsRawMemoryDumpRequest(message) {
  return MEMORY_ACCESS_RE.some((p) => p.test(message ?? ''));
}

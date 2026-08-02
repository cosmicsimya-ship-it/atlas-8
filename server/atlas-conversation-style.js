// ═══════════════════════════════════════════════════════════════════════
// Atlas Conversation Style — single source of truth for default chat tone
//
// Shared by Web + Telegram via processAtlasMessage / buildAtlasSystemPrompt.
// Deterministic intents bypass the LLM for greetings and identity questions.
// ═══════════════════════════════════════════════════════════════════════

import { getUserMemory } from './user-memory.js';
import { buildSymbolicCalendarContext } from './atlas-symbolic-calendar.js';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const STYLE_MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(STYLE_MODULE_DIR, '..');

/** Bump when default chat style / deterministic replies change. */
export const CONVERSATION_STYLE_VERSION = 'atlas-conversation-style-v2';

/** Process boot time for runtime debug (proves which code generation is live). */
export const STYLE_PROCESS_STARTED_AT = new Date().toISOString();

let cachedGitHash = null;
export function getStyleCodeVersion() {
  if (cachedGitHash != null) return cachedGitHash;
  try {
    cachedGitHash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      cwd: PROJECT_ROOT,
      windowsHide: true,
    }).trim();
  } catch {
    cachedGitHash = 'unknown';
  }
  return cachedGitHash;
}

/** Phrases forbidden in simple/casual replies (test + runtime guidance). */
export const FORBIDDEN_CASUAL_PHRASES = [
  'mimari vizyon',
  'sistem stratejisi',
  'sistemin kalbi',
  'dijital yol arkadaşı',
  'dijital yol arkadası',
  'çok katmanlı',
  'cok katmanli',
  'sembolik örüntü',
  'sembolik oruntu',
  'bilgi katmanı',
  'bilgi katmani',
  'içsel farkındalık',
  'icsel farkindalik',
  'özgür irade',
  'ozgur irade',
  'zeka katmanı',
  'zekâ katmanı',
  'senin kurduğun mimari',
  'senin kurdugun mimari',
  'sınırlar ve katmanlar',
  'sinirlar ve katmanlar',
  'sistem omurgası',
  'sistem omurgasi',
  'hangi kapıyı aralamak',
  'hangi kapiyi aralamak',
  'nasıl devam etmek istersin',
  'nasil devam etmek istersin',
  'bugün nasıl devam',
  'birlikte ilerleyebiliriz',
];

/** Extra bans for simple intents only (not detail / explicit self-intro topics). */
const FORBIDDEN_SIMPLE_EXTRA = [' misyon', 'misyonu', 'rehberlik'];

/**
 * High-priority runtime block — must override persona/founder verbosity.
 */
export function buildConversationStyleRuntimeBlock() {
  return `
## ATLAS CONVERSATION STYLE (HIGHEST PRIORITY — OVERRIDE)

Bu bölüm, alttaki/üstteki persona, founder ve örnek metinlerden ÖNCE uygulanır.

### Doğrudan cevap
- Önce kullanıcının sorusuna cevap ver.
- Giriş yapma, mesajı özetleme, kendini tanıtma, sunum yapma.

### Varsayılan uzunluk
- Selamlaşma: 2–10 kelime.
- Basit sohbet: 1–2 kısa cümle.
- Basit bilgi: 1–3 kısa cümle.
- Teknik: kısa teşhis + tek adım.
- Yalnızca kullanıcı açıkça detay isterse uzun yaz.

### Kendini anlatmama
Kullanıcı "Sen kimsin?", "Atlas nedir?", "Görevin ne?", "Neler yapabilirsin?" demedikçe:
- Atlas olduğunu açıklama
- misyon / vizyon / mimari / sembolik analiz / bilgi katmanı anlatma

### Kimlik ayrımı (zorunlu)
- "Ben kimim?" → kullanıcının kimliğini söyle. Asla "Ben Atlas'ım" deme.
- "Sen kimsin?" → Atlas'ın kimliğini söyle.

### Founder
- Kimliği koru ama her mesajda hatırlatma.
- "Lara"yı her cevaba yazma.
- Manifesto / övgü / vizyon paragrafı yazma.

### Yasak (basit sohbet)
Şunları kullanma: mimari vizyon, sistem stratejisi, sistemin kalbi, dijital yol arkadaşı, çok katmanlı, sembolik örüntü, bilgi katmanı, içsel farkındalık, özgür irade, zeka katmanı, senin kurduğun mimari, sınırlar ve katmanlar, misyon, rehberlik, hangi kapıyı aralamak, nasıl devam etmek istersin.

### Soru bitirme
Her cevabı otomatik soruyla bitirme. Gerekmedikçe "Nasıl yardımcı olabilirim?" ekleme.

### Ton
Kısa, doğal, net, sakin, ölçülü. Basit sohbette şiirsel/kurumsal sunum yok.
İçerik ve sembolik analizlerde Author Profile (Lara) sesi geçerlidir: akıcı, sembolik, düşünülerek yazılmış.

### Grup sohbeti / kısa mesaj
- Telegram gruplarında varsayılan: kısa ve doğal (1–2 cümle).
- Tek alan sorulduysa (burç, yaş, meslek) yalnızca o alanı cevapla; profil özeti dökme.
- Atlas'ın doğum tarihi / burcu / insan biyografisi yoktur; şakada rol yapılabilir ama olgu gibi yazma.
- Aynı olguyu son cevaplardaki gibi tekrar anlatma.
`.trim();
}

/**
 * @typedef {'greeting'|'how_are_you'|'who_am_i'|'who_are_you'|'thanks'|'ping'|'fatigue'|'backend_diag'|'detail'|'get_current_hijri_date'|'other'} ConversationIntent
 */

/**
 * Conceptual Hijri-calendar questions (definition / method) — not "today's date".
 * @param {string} text
 */
export function isConceptualHijriCalendarQuery(text) {
  const t = String(text ?? '').trim();
  if (!t) return false;
  return (
    /\bhicr[iî]\s+takvim(i|in|inin|e|de|den)?\b/iu.test(t) &&
    /\b(nedir|ne\s+demek|nas[ıi]l|özellik|ozellik|hakk[ıi]nda|tan[ıi]m|hesaplan[ıi]r|nasıl\s+hesap)\b/iu.test(
      t,
    )
  );
}

/**
 * Fold Turkish orthography for Hijri current-date matching (hicri/hicrî/hijri, bugün/bugun).
 * @param {string} text
 */
function foldHijriQueryText(text) {
  return String(text ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/[î]/g, 'i')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/\bhijri\b/g, 'hicri');
}

/**
 * Everyday "what is today's Hijri date?" queries (including short "Hicri?").
 * Requires hicri/hijri plus a current-time or date framing — bare ne/nedir/kaç alone is not enough.
 * @param {string} text
 */
export function isCurrentHijriDateQuery(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 120) return false;
  if (isConceptualHijriCalendarQuery(raw)) return false;

  const t = foldHijriQueryText(raw);
  const ask = '(?:kac|ne|nedir)';
  const punct = '[?.!…]*';

  // Bare / near-bare token (hicri itself is the date framing)
  if (new RegExp(`^hicri\\s*${punct}$`, 'u').test(t)) return true;
  if (new RegExp(`^hicri\\s+tarih(i)?\\s*${punct}$`, 'u').test(t)) return true;
  if (new RegExp(`^hicri\\s+${ask}\\s*${punct}$`, 'u').test(t)) return true;
  if (new RegExp(`^hicri\\s+tarih(i)?\\s+${ask}\\s*${punct}$`, 'u').test(t)) return true;

  // Today / now framings
  if (new RegExp(`^bugun\\s+hicri(\\s+tarih(i)?)?\\s*${punct}$`, 'u').test(t)) return true;
  if (new RegExp(`^bugun\\s+hicri\\s+${ask}\\s*${punct}$`, 'u').test(t)) return true;
  if (new RegExp(`^bugun\\s+hicri\\s+tarih(i)?\\s+${ask}\\s*${punct}$`, 'u').test(t)) return true;
  if (new RegExp(`^hicri\\s+bugun(\\s+${ask})?\\s*${punct}$`, 'u').test(t)) return true;
  if (new RegExp(`^bugunun\\s+hicri(\\s+tarih(i)?)?\\s*${punct}$`, 'u').test(t)) return true;
  if (new RegExp(`^bugunun\\s+hicri\\s+tarih(i)?\\s+${ask}\\s*${punct}$`, 'u').test(t)) return true;
  if (/^su\s*an\s+hicri\b/u.test(t)) return true;

  // Month / day-of-month asks (not "hicri ay nedir" — that stays conceptual/other)
  if (new RegExp(`^hicri\\s+ayin\\s+kaci\\s*${punct}$`, 'u').test(t)) return true;
  if (new RegExp(`^hicri\\s+ay\\s+ne\\s*${punct}$`, 'u').test(t)) return true;
  if (/^bugun\s+hangi\s+hicri\s+ay/u.test(t)) return true;
  if (new RegExp(`^hangi\\s+hicri\\s+ay(dayiz)?\\s*${punct}$`, 'u').test(t)) return true;
  if (/^su\s*an\s+hicri\s+hangi\s+gun/u.test(t)) return true;

  return false;
}

/**
 * Format a short user-facing current Hijri date reply (Umm al-Qura / Istanbul).
 * @param {Date} [when]
 * @param {string} [timeZone]
 */
export function formatCurrentHijriDateReply(
  when = new Date(),
  timeZone = 'Europe/Istanbul',
) {
  const ctx = buildSymbolicCalendarContext(when, timeZone);
  if (!ctx.ok || !ctx.hijri?.display) {
    return 'Hicri tarihi şu an hesaplayamadım. Lütfen biraz sonra tekrar dene.';
  }

  const miladi = new Intl.DateTimeFormat('tr-TR', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(when instanceof Date ? when : new Date(when));

  return `${miladi}, Hicri takvime göre ${ctx.hijri.display} tarihine denk gelir.`;
}

/**
 * @param {string} message
 * @returns {ConversationIntent}
 */
export function detectConversationIntent(message) {
  const text = String(message ?? '').trim();
  if (!text) return 'other';

  // Detail wins over self-identity phrases like "Atlas nedir"
  if (/detayl[ıi]|ayr[ıi]nt[ıi]|derine\s*in|ad[ıi]m\s*ad[ıi]m|kapsaml[ıi]|nedenleriyle|uzun\s*anlat/i.test(text)) {
    return 'detail';
  }

  // Current Hijri date — before bare-token identity / greeting heuristics
  if (isCurrentHijriDateQuery(text)) {
    return 'get_current_hijri_date';
  }

  if (/^(atlas)\s*[!.?]*$/i.test(text)) {
    return 'ping';
  }

  // Presence / wake — same reply as ping; must win before identity ambiguous
  if (
    /^(ordam[ıi]s[ıi]n|orada\s*m[ıi]s[ıi]n|burada\s*m[ıi]s[ıi]n|burdam[ıi]s[ıi]n)\s*[?.!…]*$/iu.test(
      text,
    )
  ) {
    return 'ping';
  }

  if (/^(merhaba|selam|selamlar|hey|hi|hello)\b/i.test(text) && text.length <= 40) {
    return 'greeting';
  }

  if (/^(naber|ne haber|nas[ıi]ls[ıi]n|nasilsin|iyi misin)\b/i.test(text) && text.length <= 40) {
    return 'how_are_you';
  }

  if (/te[sş]ekk[uü]r|sa[gğ]ol|eyvallah/i.test(text) && text.length <= 40) {
    return 'thanks';
  }

  if (/yorgun|yoruldum|bitkin/i.test(text) && text.length <= 80) {
    return 'fatigue';
  }

  if (/\b(backend|polling|atlas:status).*(neden|niye|çal[ıi][sş]m|cevap)|neden cevap vermiyor/i.test(text)) {
    return 'backend_diag';
  }

  if (/\b(sen kimsin|kimsin sen|atlas nedir|g[oö]revin ne|neler yapabilirsin)\b/i.test(text)) {
    return 'who_are_you';
  }

  if (
    /\b(ben kimim|ben sistemde kimim|kim oldu[gğ]umu|beni\s+tan[ıi](?:d[ıi]n|yor\s+musun))\b/i.test(
      text,
    )
  ) {
    return 'who_am_i';
  }

  return 'other';
}

/**
 * @param {string} message
 */
export function isUserIdentityQuestion(message) {
  return detectConversationIntent(message) === 'who_am_i';
}

/**
 * @param {string} message
 */
export function isAtlasSelfIdentityQuestion(message) {
  return detectConversationIntent(message) === 'who_are_you';
}

/**
 * @param {string} reply
 * @param {ConversationIntent} intent
 */
export function containsForbiddenCasualPhrase(reply, intent = 'other') {
  const lower = ` ${String(reply ?? '').toLowerCase()} `;
  const hits = FORBIDDEN_CASUAL_PHRASES.filter((p) => lower.includes(p.toLowerCase()));
  if (intent === 'greeting' || intent === 'how_are_you' || intent === 'thanks' || intent === 'ping' || intent === 'fatigue' || intent === 'get_current_hijri_date') {
    for (const p of FORBIDDEN_SIMPLE_EXTRA) {
      if (lower.includes(p.toLowerCase()) && !hits.includes(p.trim())) hits.push(p.trim());
    }
  }
  return hits;
}

/**
 * Cap output length by intent — never mid-sentence cut; this is generation budget only.
 * @param {string} message
 * @param {{ maxTokens?: number, mode?: string, tarotActive?: boolean, intent?: ConversationIntent }} [options]
 */
export function resolveReplyMaxTokens(message, options = {}) {
  if (options.maxTokens != null) return options.maxTokens;
  if (options.tarotActive || options.mode === 'meta-synthesis') {
    return 1400;
  }
  if (options.astrologyLength === 'short') return 280;
  if (options.astrologyLength === 'detailed') return 1200;
  if (options.astrologyLength === 'standard' || options.mode === 'daily-guide') {
    return 700;
  }

  const intent = options.intent ?? detectConversationIntent(message);
  if (intent === 'detail') return 1200;
  if (intent === 'who_am_i' || intent === 'who_are_you') return 120;
  if (intent === 'get_current_hijri_date') return 80;
  if (intent === 'greeting' || intent === 'thanks' || intent === 'ping') return 40;
  if (intent === 'how_are_you' || intent === 'fatigue') return 60;
  if (intent === 'backend_diag') return 90;

  const text = String(message ?? '').trim();
  // Short technical/diagnostic questions still need room for a full diagnosis sentence.
  if (/\?|neden|niye|nas[ıi]l|fix|error|bug|backend|polling|node|api|crash|leak/i.test(text)) {
    return 350;
  }
  if (text.length <= 48) return 160;
  if (text.length <= 120) return 280;
  return 500;
}

/**
 * Deterministic replies for clear casual intents — skips LLM manifesto risk.
 * @param {{
 *   message: string,
 *   userId?: string,
 *   founderSession?: import('./founder-identity.js').FounderSession|null,
 * }} input
 * @returns {{ reply: string, intent: ConversationIntent } | null}
 */
export function tryDeterministicConversationReply(input) {
  const intent = detectConversationIntent(input.message);
  const founder = input.founderSession;
  const founderName =
    founder?.biography?.preferredName ?? founder?.knowledge?.founderName ?? 'Lara';

  switch (intent) {
    case 'greeting':
      return { intent, reply: founder ? `Merhaba ${founderName}.` : 'Merhaba.' };
    case 'how_are_you':
      return { intent, reply: 'İyiyim, teşekkür ederim. Sen nasılsın?' };
    case 'thanks':
      return { intent, reply: 'Rica ederim.' };
    case 'ping':
      return { intent, reply: 'Buradayım.' };
    case 'fatigue':
      return { intent, reply: 'Kendini fazla zorlama. Biraz dinlenmen iyi olabilir.' };
    case 'backend_diag':
      return {
        intent,
        reply:
          'Muhtemelen backend veya Telegram polling durmuş. Önce `npm run atlas:status` çıktısını kontrol et.',
      };
    case 'who_are_you':
      return {
        intent,
        reply:
          "Ben Atlas'ım. Sorularını yanıtlayan ve görevlerinde yardımcı olan yapay zekâ asistanınım.",
      };
    case 'get_current_hijri_date':
      return {
        intent,
        reply: formatCurrentHijriDateReply(new Date(), 'Europe/Istanbul'),
      };
    case 'who_am_i': {
      if (founder) {
        const title =
          founder.biography?.title ??
          founder.knowledge?.role ??
          "Atlas'ın kurucusu ve sistem mimarı";
        return {
          intent,
          reply: `Evet. Sen ${founderName}'sın; ${title} olarak kayıtlısın.`,
        };
      }
      const userId = input.userId?.trim();
      if (userId && userId !== 'web:anonymous') {
        const memory = getUserMemory(userId);
        const name = memory?.profile?.name;
        if (name) {
          return { intent, reply: `Kayıtlarıma göre adın ${name}.` };
        }
      }
      return { intent, reply: 'Henüz seni tanımlayacak yeterli bilgim yok.' };
    }
    default:
      return null;
  }
}

/**
 * Context gate for founder identity injection at response generation.
 *
 * Founder session itself is resolved from channel-linked userId — never from
 * keywords. This gate only decides whether compact identity, heavy knowledge,
 * and "Kurucu Oturumu" runtime rules may enter the prompt.
 *
 * Inject ONLY for founder/authority/admin identity intents. Never for everyday
 * chat, group messages, YouTube/link commentary, astrology, ebced, numerology,
 * greetings, or general knowledge answers.
 *
 * Bare "sistem" / "mimari" alone must NOT open the gate
 * (avoids false positives: "Güneş sistemi", "Sistem nasıl çalışıyor?").
 *
 * @param {string} message
 * @param {import('./founder-identity.js').FounderSession|null} founderSession
 * @param {{ isGroup?: boolean }} [options]
 */
export function shouldInjectFounderContextBlocks(message, founderSession, options = {}) {
  if (!founderSession) return false;
  // Group chats: never auto-inject founder identity into prompts.
  if (options.isGroup === true) return false;

  const intent = detectConversationIntent(message);
  if (intent === 'who_am_i') return true;

  // Founder / role / authority verification.
  if (/\b(kurucu|founder|yetki|rolüm|rolun)\b/i.test(message)) return true;
  // Administrative / management operations tied to founder authority.
  if (
    /\b(y[oö]netimsel|y[oö]netici\s+yetki|admin\s+yetki|yetki\s+do[gğ]rula|otorite\s+do[gğ]rula)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (/\b(normal kullanıcı|fark|nereden biliyorsun)\b/i.test(message)) return true;
  // Atlas / founder-scoped system phrases only — not generic "sistem".
  if (
    /\b(?:atlas(?:'?[ıi]n)?\s+sistem(?:i|inde|deki)?|atlas\s+mimarisi|atlas\s+backend|atlas\s+altyap[ıi]|sistem\s+mimar[ıi]|kurucu\s+sistemi|founder\s+identity|benim\s+sistemdeki\s+rolüm|atlas\s+nas[ıi]l\s+geli[sş]tirildi)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  // Self-recognition / preferred-name questions must load profile without role keywords.
  if (/\bbeni\s+tan[ıi](?:d[ıi]n|yor\s+musun)\b/i.test(message)) return true;
  const preferred =
    founderSession.biography?.preferredName ?? founderSession.knowledge?.founderName;
  if (preferred) {
    const escaped = preferred.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameAsk = new RegExp(
      `\\b${escaped}(?:'?[nınınun]|'?y[ıi]|'?ya|'?yla)?\\s+tan[ıi]`,
      'iu',
    );
    if (nameAsk.test(message)) return true;
    // "Ben Lara" / "Lara ben" from verified founder — identity context required.
    const selfName = new RegExp(
      `(?:^ben\\s+${escaped}\\b|^${escaped}\\s+ben(?:im)?\\b)`,
      'iu',
    );
    if (selfName.test(message)) return true;
  }
  return false;
}

/**
 * Alias — same context gate used by response composer for identity injection.
 * @param {string} message
 * @param {import('./founder-identity.js').FounderSession|null} founderSession
 * @param {{ isGroup?: boolean }} [options]
 */
export function shouldInjectFounderIdentity(message, founderSession, options = {}) {
  return shouldInjectFounderContextBlocks(message, founderSession, options);
}

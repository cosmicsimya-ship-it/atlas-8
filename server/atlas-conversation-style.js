// ═══════════════════════════════════════════════════════════════════════
// Atlas Conversation Style — single source of truth for default chat tone
//
// Shared by Web + Telegram via processAtlasMessage / buildAtlasSystemPrompt.
// Deterministic intents bypass the LLM for greetings and identity questions.
// ═══════════════════════════════════════════════════════════════════════

import { getUserMemory } from './user-memory.js';
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
Kısa, doğal, net, sakin, ölçülü. Şiirsel/kurumsal sunum yok.
`.trim();
}

/**
 * @typedef {'greeting'|'how_are_you'|'who_am_i'|'who_are_you'|'thanks'|'ping'|'fatigue'|'backend_diag'|'detail'|'other'} ConversationIntent
 */

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

  if (/^(atlas)\s*[!.?]*$/i.test(text)) {
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

  if (/\b(ben kimim|kim oldu[gğ]umu)\b/i.test(text)) {
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
  if (intent === 'greeting' || intent === 'how_are_you' || intent === 'thanks' || intent === 'ping' || intent === 'fatigue') {
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
    case 'who_am_i': {
      if (founder) {
        return {
          intent,
          reply: `Sen ${founderName}'sın. Atlas'ın kurucusu ve sistem mimarısın.`,
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
 * Whether founder heavy prompt blocks are needed for this message.
 * @param {string} message
 * @param {import('./founder-identity.js').FounderSession|null} founderSession
 */
export function shouldInjectFounderContextBlocks(message, founderSession) {
  if (!founderSession) return false;
  const intent = detectConversationIntent(message);
  if (intent === 'who_am_i') return true;
  if (/\b(kurucu|founder|mimari|sistem|yetki|rolüm|rolun)\b/i.test(message)) return true;
  if (/\b(normal kullanıcı|fark|nereden biliyorsun)\b/i.test(message)) return true;
  return false;
}

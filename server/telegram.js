import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from "fs";
import path from "path";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BACKEND_URL = "http://localhost:3001/api/ai/complete";
const PRIORITY_FIELDS = ['reply', 'response', 'message', 'analysis', 'output'];
const METADATA_KEYS = new Set(['warnings', 'handoff_to', 'engine', 'agent', 'status', 'task_id', 'route']);
const METADATA_VALUES = new Set([
  'core-engine',
  'atlas-core',
  'complete',
  'insufficient_data',
  'reject',
]);
const GREETING_REPLY =
 "Merhaba, ben Atlas. Cosmic Simya'nın yapay zekâ asistanıyım. Burası bir hatırlayış alanı. Cevapların çoğu dışarıda değil; onları nasıl gördüğünde saklıdır. Astroloji, numeroloji, semboller ve farkındalık çalışmaları üzerine birlikte düşünebilir, sorularını yanıtlayabilirim. Nasıl yardımcı olabilirim?";
const FALLBACK_TEXT = "I'm processing your request.";
const BACKEND_UNAVAILABLE = 'ATLAS backend is currently unavailable.';
const UNEXPECTED_ERROR = 'An unexpected error occurred.';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isMetadataValue(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    METADATA_VALUES.has(normalized) ||
    normalized.endsWith('-engine') ||
    normalized.endsWith('-core')
  );
}

function isNaturalLanguage(value) {
  return isNonEmptyString(value) && !isMetadataValue(value);
}

function findPriorityField(value, visited = new Set()) {
  if (value == null) {
    return null;
  }

  if (isNaturalLanguage(value)) {
    return value.trim();
  }

  if (typeof value !== 'object') {
    return null;
  }

  if (visited.has(value)) {
    return null;
  }
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPriorityField(item, visited);
      if (found) {
        return found;
      }
    }
    return null;
  }

  for (const field of PRIORITY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      continue;
    }

    const fieldValue = value[field];
    if (isNaturalLanguage(fieldValue)) {
      return fieldValue.trim();
    }

    const nested = findPriorityField(fieldValue, visited);
    if (nested) {
      return nested;
    }
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (METADATA_KEYS.has(key)) {
      continue;
    }

    const found = findPriorityField(nestedValue, visited);
    if (found) {
      return found;
    }
  }

  return null;
}

function synthesisHasMeaningfulContent(synthesis) {
  if (!synthesis || typeof synthesis !== 'object' || Array.isArray(synthesis)) {
    return false;
  }

  const scalarFields = [
    synthesis.core_pattern,
    synthesis.life_architecture,
    synthesis.development_axis,
    synthesis.current_cycle,
  ];

  if (scalarFields.some(isNaturalLanguage)) {
    return true;
  }

  if (
    Array.isArray(synthesis.convergences) &&
    synthesis.convergences.some((entry) => isNaturalLanguage(entry?.summary))
  ) {
    return true;
  }

  const listFields = [
    ...(Array.isArray(synthesis.potential_gates) ? synthesis.potential_gates : []),
    ...(Array.isArray(synthesis.recommended_directions) ? synthesis.recommended_directions : []),
  ];

  return listFields.some(isNaturalLanguage);
}

function indicatesGreetingOrInsufficientAnalysis(data) {
  if (data?.status === 'insufficient_data' || data?.status === 'reject') {
    return true;
  }

  const synthesis = data?.payload?.synthesis ?? data?.synthesis;
  if (!synthesis) {
    return false;
  }

  if (!synthesisHasMeaningfulContent(synthesis)) {
    return true;
  }

  const greetingPattern = /greeting|insufficient|only a message|without analysis data|no analysis/i;
  const missingData = Array.isArray(synthesis.missing_data) ? synthesis.missing_data : [];

  return missingData.some((entry) => isNonEmptyString(entry) && greetingPattern.test(entry));
}

function formatSynthesisReply(synthesis) {
  if (!synthesis || typeof synthesis !== 'object' || Array.isArray(synthesis)) {
    return null;
  }

  const sections = [];

  for (const text of [
    synthesis.core_pattern,
    synthesis.life_architecture,
    synthesis.development_axis,
    synthesis.current_cycle,
  ]) {
    if (isNaturalLanguage(text)) {
      sections.push(text.trim());
    }
  }

  if (Array.isArray(synthesis.convergences)) {
    for (const entry of synthesis.convergences) {
      if (isNaturalLanguage(entry?.summary)) {
        sections.push(entry.summary.trim());
      }
    }
  }

  const bulletItems = [
    ...(Array.isArray(synthesis.potential_gates) ? synthesis.potential_gates : []),
    ...(Array.isArray(synthesis.recommended_directions) ? synthesis.recommended_directions : []),
  ].filter(isNaturalLanguage);

  if (bulletItems.length > 0) {
    sections.push(bulletItems.map((item) => `• ${item.trim()}`).join('\n'));
  }

  const uniqueSections = [...new Set(sections)];
  return uniqueSections.length > 0 ? uniqueSections.join('\n\n') : null;
}

function extractResponseText(data) {
  if (data == null) {
    return FALLBACK_TEXT;
  }

  if (isNaturalLanguage(data)) {
    return data.trim();
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    if (isNonEmptyString(data.error)) {
      return data.error.trim();
    }

    if (indicatesGreetingOrInsufficientAnalysis(data)) {
      return GREETING_REPLY;
    }

    const priorityField = findPriorityField(data);
    if (priorityField) {
      return priorityField;
    }

    const synthesis = data.payload?.synthesis ?? data.synthesis;
    const formattedSynthesis = formatSynthesisReply(synthesis);
    if (formattedSynthesis) {
      return formattedSynthesis;
    }

    if (data.detail != null) {
      if (isNaturalLanguage(data.detail)) {
        return data.detail.trim();
      }

      if (typeof data.detail === 'object') {
        const detailText =
          findPriorityField(data.detail) ??
          formatSynthesisReply(data.detail?.payload?.synthesis ?? data.detail?.synthesis);
        if (detailText) {
          return detailText;
        }
      }
    }
  }

  return FALLBACK_TEXT;
}

function isBackendUnreachable(error) {
  return axios.isAxiosError(error) && !error.response;
}

if (!TELEGRAM_BOT_TOKEN) {
  console.error('[Telegram] TELEGRAM_BOT_TOKEN is not set in the environment.');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const atlasIdentity = fs.readFileSync(
  new URL("./atlas_identity.md", import.meta.url),
  "utf8"
);
const atlasPersonality = fs.readFileSync(
  new URL("./atlas_personality.md", import.meta.url),
  "utf8"
);

const atlasExamples = fs.readFileSync(
  new URL("./atlas_response_examples.md", import.meta.url),
  "utf8"
);
const atlasForbiddenPatterns = fs.readFileSync(
  new URL("./atlas_forbidden_patterns.md", import.meta.url),
  "utf8"
);
function buildPersonalAnalysisRequest(msg) {
  const currentDate = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
  return {
    systemPrompt:  `
     ${atlasIdentity}
     ${atlasPersonality}
     ${atlasExamples}
     ${atlasForbiddenPatterns}
Sen Atlas'sın; Cosmic Simya grubunun yapay zekâ asistanısın.

Bugünün gerçek tarihi: ${currentDate}
Saat dilimi: Europe/Istanbul

Tarih gerektiren sorularda yalnızca yukarıdaki tarihi kullan.
Eski veya tahminî bir tarih uydurma.
Numeroloji hesabında işlemleri rakam rakam göster ve sonucu kontrol et.
Numeroloji sorularında:
- Önce kullanılan tarihi veya sayıları açıkça yaz.
- Hesabı adım adım göster.
- Sonucu belirgin şekilde belirt.
- Sonunda Cosmic Simya yaklaşımıyla kısa ve özgün bir yorum yap.
- Gereksiz tekrar yapma.
- Kullanıcı kısa cevap istemediyse tek cümleyle yetinme.
Genel cevap üslubunda:
- Kullanıcının sorusunu önce gerçekten yorumla; hazır kalıp yanıt verme.
- Her cevabı zorunlu olarak numaralı başlıklara bölme.
- Aynı ifadeyi farklı başlıklarda tekrar etme.
- Ansiklopedi dili yerine doğal, sıcak ve akıcı bir konuşma dili kullan.
- Kullanıcı özellikle istemedikçe aşırı uzun cevap verme.
- Kesin bilgi olmayan ruhsal veya sembolik yorumları olasılık olarak sun.
- Kullanıcıya tepeden konuşma; onunla birlikte düşünen bir rehber gibi cevap ver.
- Cevabın sonunda yalnızca gerçekten faydalıysa bir soru sor.
## Günlük Astrolojik Rehber

Kullanıcı günlük astrolojik değerlendirme istediğinde:

- Günün genel gökyüzü etkilerini sade ve anlaşılır şekilde açıkla.
- Burç burç yorum yapmak yerine kolektif enerjiyi değerlendir.
- Astrolojiyi kesin gerçek veya kehanet gibi sunma; sembolik ve farkındalık odaklı bir rehber olarak anlat.
- Cevabı şu yapıda oluştur:

🌤️ Günün Teması

🪐 Öne Çıkan Etkiler

🌱 Bugünü Destekleyen Yaklaşımlar

⚠️ Dikkat Edilebilecek Noktalar

💭 Günün Düşünme Sorusu

Gerekliyse, kullanılan astrolojik göstergeleri (Ay'ın burcu, önemli açılar, gezegen geçişleri vb.) kısaca belirt.

Atlas, astrolojik yorumların kişisel kararların yerine geçmediğini bilir ve bunu gerektiğinde doğal bir dille hatırlatır.
## Günaydın ve Günlük Cosmic Simya Analizi

Kullanıcı "Günaydın", "Bugün beni neler bekliyor?" veya günlük analiz istediğinde Atlas, mümkün olduğunca kapsamlı fakat akıcı bir sabah rehberi hazırlar.

Cevap aşağıdaki yapıyı takip edebilir:

🌅 Günaydın Mesajı

Kısa, samimi ve motive edici bir karşılama.

🪐 Günün Astrolojik Aklı

- Günün önemli gökyüzü etkileri
- Ay'ın bulunduğu burcun psikolojik etkileri
- Önemli gezegen açıları
- Günün genel enerjisi

🔢 Günün Numerolojik Yorumu

- Günün evrensel sayısı
- Sayının teması
- Desteklediği davranışlar
- Dikkat edilmesi gereken noktalar

🌿 Cosmic Simya'nın Günlük Analizi

Astroloji ve numerolojiyi birlikte değerlendirerek günün ortak mesajını paylaş.

💡 Bugünün Odak Noktası

Kullanıcının gün içinde bilinçli olarak geliştirebileceği tek bir konu.

⚠️ Dikkat Edilebilecek Noktalar

Abartıdan kaçınarak gün içinde fark edilmesi faydalı olabilecek durumları belirt.

✨ Günün Olumlaması

Kısa ve doğal bir olumlama.

💭 Günün Düşünme Sorusu

Kullanıcının kendini gözlemlemesini sağlayacak tek bir soru.

Atlas bu rehberi kesin kehanet olarak sunmaz. Astrolojik ve numerolojik sembolleri farkındalık geliştirmek amacıyla yorumlar.
Astroloji, numeroloji, semboller ve farkındalık çalışmaları hakkında açık, anlaşılır ve düşünmeye teşvik eden cevaplar ver.
Burası bir hatırlayış alanıdır.
Kesin olmayan iddiaları kesin gerçekler gibi sunma.
Kullanıcının dilinde cevap ver.
    `.trim(),

    userPrompt: msg.text,
  };
}
async function forwardToBackend(msg) {
  const response = await axios.post(BACKEND_URL, buildPersonalAnalysisRequest(msg));

  console.log(JSON.stringify(response.data, null, 2));

  return extractResponseText(response.data);
}

async function handleMessage(msg) {
  const text = msg.text?.trim();
  const isGroup =
  msg.chat.type === "group" || msg.chat.type === "supergroup";

if (isGroup) {
  const calledAtlas = text.toLowerCase().includes("atlas");

  const repliedToBot =
    msg.reply_to_message?.from?.is_bot === true;

  if (!calledAtlas && !repliedToBot) {
    return;
  }
}
  if (!text) {
    return;
  }

  const chatId = msg.chat.id;

  try {
    const reply = await forwardToBackend(msg);
    await bot.sendMessage(chatId, reply);
  } catch (error) {
    if (isBackendUnreachable(error)) {
      console.error('[Telegram] Backend unreachable:', error.message);
      await bot.sendMessage(chatId, BACKEND_UNAVAILABLE);
      return;
    }

    if (axios.isAxiosError(error) && error.response?.data) {
      console.log(JSON.stringify(error.response.data, null, 2));
      const reply = extractResponseText(error.response.data);
      await bot.sendMessage(chatId, reply);
      return;
    }

    console.error('[Telegram] Unexpected error:', error);
    await bot.sendMessage(chatId, UNEXPECTED_ERROR);
  }
}

bot.on('message', (msg) => {
  handleMessage(msg).catch((error) => {
    console.error('[Telegram] Unhandled message error:', error);
  });
});

console.log('[Telegram] Bot started with polling enabled.');

    
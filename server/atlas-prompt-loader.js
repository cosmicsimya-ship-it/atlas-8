// ═══════════════════════════════════════════════════════════════════════
// Atlas Prompt Loader — profile-based prompt assembly
//
// Profiles load only the modules each task type needs.
// Meta Synthesis (atlas_meta_synthesis.md) is injected ONLY for
// meta-synthesis and personal-analysis tasks — never for shorts/generic.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildFounderRuntimeRules } from './founder-knowledge.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = __dirname;

/**
 * @typedef {'conversational' | 'meta-synthesis' | 'personal-analysis' | 'shorts' | 'generic'} PromptProfile
 */

/** Shared Atlas modules — identity, safety, reasoning, style (no meta synthesis). */
export const ATLAS_COMMON_MODULES = [
  'atlas_identity',
  'atlas_reasoning',
  'atlas_decision',
  'atlas_conversation',
  'atlas_tarot_spread',
  'atlas_response_style',
  'atlas_personality',
  'atlas_response_examples',
  'atlas_forbidden_patterns',
  'atlas_memory',
  'atlas_quality_check',
];

/** Meta synthesis module — injected only when profile requires it. */
export const META_SYNTHESIS_MODULE = 'atlas_meta_synthesis';

/** Tarot spread action protocol — always available in conversational chat. */
export const TAROT_SPREAD_MODULE = 'atlas_tarot_spread';

/** Profile → module list. Empty arrays mean caller supplies the full prompt. */
export const PROMPT_PROFILE_MODULES = {
  conversational: ATLAS_COMMON_MODULES,
  'meta-synthesis': [
    'atlas_identity',
    META_SYNTHESIS_MODULE,
    TAROT_SPREAD_MODULE,
    'atlas_reasoning',
    'atlas_decision',
    'atlas_conversation',
    'atlas_response_style',
    'atlas_personality',
    'atlas_response_examples',
    'atlas_forbidden_patterns',
    'atlas_memory',
    'atlas_quality_check',
  ],
  'personal-analysis': [], // served by runner/agent-loader loadCoreEnginePrompt()
  shorts: [],
  generic: [],
};

const moduleCache = new Map();

export function loadAtlasModule(name) {
  if (moduleCache.has(name)) {
    return moduleCache.get(name);
  }

  const filePath = join(SERVER_DIR, `${name}.md`);
  if (!existsSync(filePath)) {
    throw new Error(`Atlas module not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  moduleCache.set(name, content);
  return content;
}

export function loadAtlasModules(moduleNames) {
  if (!moduleNames.length) {
    return '';
  }
  return moduleNames.map((name) => loadAtlasModule(name)).join('\n\n---\n\n');
}

export function getMetaSynthesisPrompt() {
  return loadAtlasModule(META_SYNTHESIS_MODULE);
}

export function getTarotSpreadPrompt() {
  return loadAtlasModule(TAROT_SPREAD_MODULE);
}

export function getCurrentDateTr() {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

/**
 * Map a chat analysis mode to a prompt profile.
 * @param {string} mode
 * @returns {PromptProfile}
 */
export function resolveChatProfile(mode) {
  if (mode === 'meta-synthesis' || mode === 'daily-guide') {
    return 'meta-synthesis';
  }
  return 'conversational';
}

/**
 * Runtime rules appended to Atlas-powered chat profiles.
 * Symbolic / numerology / synthesis directives appear ONLY for meta-synthesis mode.
 * @param {{ currentDate?: string, mode?: string, profile?: PromptProfile, tarotIntent?: import('./symbolic-synthesis.js').TarotSpreadIntent|null, founderProfile?: import('./founder-knowledge.js').FounderProfile|null }} [options]
 */
export function buildRuntimeRules(options = {}) {
  const currentDate = options.currentDate ?? getCurrentDateTr();
  const mode = options.mode ?? 'conversational';
  const profile = options.profile ?? resolveChatProfile(mode);
  const includeSymbolic = profile === 'meta-synthesis';
  const tarotIntent = options.tarotIntent ?? null;
  const founderProfile = options.founderProfile ?? null;

  const founderDirective = founderProfile ? buildFounderRuntimeRules(founderProfile) : '';

  const modeDirective =
    mode === 'meta-synthesis'
      ? `
## Aktif Mod: Meta Sentez

Bu mesaj çoklu sembolik sistem analizi gerektiriyor.
atlas_meta_synthesis.md içindeki motoru uygula:
- Kesişim ve çelişki analizi yap
- Tek kaynaklı çıkarımı sentez gibi sunma
- Güven seviyesini belirt
- Mümkünse bölüm 16 sentez yapısını kullan (Ana Tema, Destekleyen Sistemler, Ayrışan Noktalar, Çelişkinin Anlamı, Kör Nokta, Gerçeklik Kontrolü, Güven Seviyesi, Sentez)
- Fal dili ve kesin kehanet kullanma`
      : mode === 'daily-guide'
        ? `
## Aktif Mod: Günlük Rehber

Günaydın / günlük analiz isteği algılandı.
Astroloji ve numerolojiyi birlikte değerlendir; ortak temayı sentezle.
Kesin kehanet sunma; sembolik farkındalık odaklı kal.`
        : '';

  const symbolicRules = includeSymbolic
    ? `
Numeroloji hesabında işlemleri rakam rakam göster ve sonucu kontrol et.
Numeroloji sorularında:
- Önce kullanılan tarihi veya sayıları açıkça yaz.
- Hesabı adım adım göster.
- Sonucu belirgin şekilde belirt.
- Sonunda Cosmic Simya yaklaşımıyla kısa ve özgün bir yorum yap.

## Günlük Astrolojik Rehber

Kullanıcı günlük astrolojik değerlendirme istediğinde:
- Günün genel gökyüzü etkilerini sade ve anlaşılır şekilde açıkla.
- Burç burç yorum yapmak yerine kolektif enerjiyi değerlendir.
- Astrolojiyi kesin gerçek veya kehanet gibi sunma.

## Günaydın ve Günlük Cosmic Simya Analizi

Kullanıcı "Günaydın", "Bugün beni neler bekliyor?" veya günlük analiz istediğinde:
- Astroloji ve numerolojiyi birlikte değerlendirerek günün ortak mesajını sentezle.
- Kesin kehanet olarak sunma.

Astroloji, numeroloji, semboller ve farkındalık çalışmaları hakkında açık cevaplar ver.
Burası bir hatırlayış alanıdır.
Kesin olmayan iddiaları kesin gerçekler gibi sunma.`
    : '';

  const tarotDirective = tarotIntent?.active
    ? `
## Aktif Mod: Tarot Açılımı

Kullanıcı tarot açılımı komutu verdi veya aktif tarot bağlamı devam ediyor.
atlas_tarot_spread.md protokolünü uygula:
- Fiziksel deste reddi veya tarot eğitimi verme; doğrudan eyleme geç
- Classic Tarot destesinden sembolik kart seç
- Kart isimlerini açıkça yaz
- Örüntü, gizli dinamik, kör nokta ve sentez içeren yorum yap
- Bağlam sormadan önceki talimatı uygula
${
  tarotIntent.intent === 'reveal-cards'
    ? '- Bu turda yalnızca son seçilen kart isimlerini ve pozisyonlarını listele'
    : tarotIntent.intent === 'interpret'
      ? '- Yeni kart seçme; konuşmada zaten seçilmiş kartları yorumla'
      : '- Varsayılan üç kartlı açılım yap (kullanıcı farklı sayı belirtmediyse)'
}`
    : '';

  return `
Sen Atlas'sın; Cosmic Simya grubunun yapay zekâ asistanısın.

Bugünün gerçek tarihi: ${currentDate}
Saat dilimi: Europe/Istanbul
${modeDirective}
${founderDirective ? `\n${founderDirective}\n` : ''}
${tarotDirective}

Tarih gerektiren sorularda yalnızca yukarıdaki tarihi kullan.
Eski veya tahminî bir tarih uydurma.
${symbolicRules}

Genel cevap üslubunda:
- Kullanıcının sorusunu önce gerçekten yorumla; hazır kalıp yanıt verme.
- Her cevabı zorunlu olarak numaralı başlıklara bölme.
- Aynı ifadeyi farklı başlıklarda tekrar etme.
- Ansiklopedi dili yerine doğal, sıcak ve akıcı bir konuşma dili kullan.
- Kullanıcı özellikle istemedikçe aşırı uzun cevap verme.
- Kesin bilgi olmayan ruhsal veya sembolik yorumları olasılık olarak sun.
- Kullanıcıya tepeden konuşma; onunla birlikte düşünen bir rehber gibi cevap ver.
- Cevabın sonunda yalnızca gerçekten faydalıysa bir soru sor.
Kullanıcının dilinde cevap ver.
`.trim();
}

/**
 * Build a system prompt for a named profile.
 * @param {{ profile?: PromptProfile, mode?: string, currentDate?: string, tarotIntent?: import('./symbolic-synthesis.js').TarotSpreadIntent|null, founderProfile?: import('./founder-knowledge.js').FounderProfile|null }} [options]
 * @returns {string} Empty string for shorts/generic — caller must supply the prompt.
 */
export function buildAtlasSystemPrompt(options = {}) {
  const profile = options.profile ?? 'conversational';
  const modules = PROMPT_PROFILE_MODULES[profile];

  if (!modules || modules.length === 0) {
    return '';
  }

  const base = loadAtlasModules(modules);
  const runtime = buildRuntimeRules({
    currentDate: options.currentDate,
    mode: options.mode,
    profile,
    tarotIntent: options.tarotIntent,
    founderProfile: options.founderProfile,
  });
  return `${base}\n\n---\n\n${runtime}`;
}

/** @deprecated Use buildAtlasSystemPrompt with profile instead. */
export function buildConversationalSystemPrompt(options = {}) {
  const profile = resolveChatProfile(options.mode ?? 'conversational');
  return buildAtlasSystemPrompt({
    profile,
    mode: options.mode,
    currentDate: options.currentDate,
  });
}

export function clearAtlasModuleCache() {
  moduleCache.clear();
}

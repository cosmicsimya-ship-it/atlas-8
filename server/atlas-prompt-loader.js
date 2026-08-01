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
import { buildFounderRuntimeRules, buildFounderSystemPromptSection } from './founder-knowledge.js';
import { getFounderBiographyProfile } from './founder-profile.js';
import {
  buildConversationStyleRuntimeBlock,
  shouldInjectFounderContextBlocks,
} from './atlas-conversation-style.js';
import { PRIVACY_SYSTEM_INSTRUCTION } from './privacy/privacy-policy.js';
import { IDENTITY_SAFETY_SYSTEM_RULES } from './identity-claims.js';
import { SPEAKER_ATTRIBUTION_SYSTEM_RULES } from './speaker-attribution.js';
import { ABJAD_VERIFICATION_SYSTEM_RULES } from './abjad-verification.js';

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
  'atlas_response_style',
  'atlas_personality',
  'atlas_forbidden_patterns',
  'atlas_memory',
  'atlas_quality_check',
];

/** Meta synthesis module — injected only when profile requires it. */
export const META_SYNTHESIS_MODULE = 'atlas_meta_synthesis';

/** Tarot spread action protocol — loaded only when tarot intent is active. */
export const TAROT_SPREAD_MODULE = 'atlas_tarot_spread';

/** Profile → module list. Empty arrays mean caller supplies the full prompt. */
export const PROMPT_PROFILE_MODULES = {
  conversational: ATLAS_COMMON_MODULES,
  'meta-synthesis': [
    'atlas_identity',
    META_SYNTHESIS_MODULE,
    'atlas_reasoning',
    'atlas_decision',
    'atlas_conversation',
    'atlas_response_style',
    'atlas_personality',
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
 * @param {{ currentDate?: string, mode?: string, profile?: PromptProfile, tarotIntent?: import('./symbolic-synthesis.js').TarotSpreadIntent|null, founderProfile?: import('./founder-knowledge.js').FounderProfile|null, founderSession?: import('./founder-identity.js').FounderSession|null }} [options]
 */
export function buildRuntimeRules(options = {}) {
  const currentDate = options.currentDate ?? getCurrentDateTr();
  const mode = options.mode ?? 'conversational';
  const profile = options.profile ?? resolveChatProfile(mode);
  const includeSymbolic = profile === 'meta-synthesis';
  const tarotIntent = options.tarotIntent ?? null;
  const founderSession = options.founderSession ?? null;
  const founderProfile = founderSession?.knowledge ?? options.founderProfile ?? null;

  const founderDirective = founderSession
    ? `
## Kurucu Oturumu Aktif

founderResolved: true
Kurucu kimliğini doğrula ama her mesajda hatırlatma veya manifesto yazma.
Gündelik sohbette kısa ve doğal konuş.`
    : founderProfile
      ? `
## Kurucu Oturumu Aktif (Founder Identity)

founderResolved: true
${buildFounderRuntimeRules(founderProfile)}
Kurucu kimliğini her mesajda hatırlatma.`
      : '';

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
## Aktif Mod: Günlük Rehber (sembolik)

Kullanıcı türü netleşmiş bir günlük/sembolik analiz istedi.
Önce VERIFIED DATA bloklarındaki tarih ve gökyüzü verilerini kullan; uydurma.
Analiz türü belirsizse uzun yorum yazma; netleştirme sor.
Kesin kehanet sunma; sembolik farkındalık odaklı kal.`
        : '';

  const symbolicRules = includeSymbolic
    ? `
Numeroloji hesabında yalnızca VERIFIED NUMEROLOGY DATA varsa onu kullan; işlemleri gerektiğinde kısaca göster.

Ebced / Esma sayısal sonuçlarında yalnızca VERIFIED ABJAD / ESMA DATA veya deterministik calculateAbjad / findEsmaMatches çıktısını kullan.
Kullanıcı itirazını otomatik doğru kabul etme; harf harf yeniden hesapla. Esma adı uydurma.

## Astroloji / Günlük Sembolik Analiz Kuralları

- Analiz türü (genel / natal transit / ilişki / konu) açık değilse uzun gökyüzü yorumu YAZMA; kısa netleştirme sor.
- Gezegen, Ay burcu, Ay fazı ve Hicri tarihi yalnızca VERIFIED DATA bloklarından al; model hafızasından uydurma.
- Varsayılan analiz konumunu belirt (veya kullanıcıdan şehir iste).
- Astroloji/numeroloji sembolik/yorumlayıcıdır; tıbbi, hukuki, finansal kararların yerine geçmez.
- "Kesin olacak", "kaçınılmaz", "başına gelecek" gibi kader dili kullanma.
- Her cevapta zorunlu "Destekleyen sistemler / ayrışan noktalar / kör nokta / gerçeklik kontrolü" başlıkları açma.
- Varsayılan uzunluk: kısa özet ~150 kelime, standart 300–500; "detaylı" istenirse daha kapsamlı.
- İlk paragrafta ana temayı söyle; aynı temayı tekrar etme.`
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
- Ansiklopedi dili yerine doğal, sade konuşma dili kullan.
- Kullanıcı özellikle istemedikçe aşırı uzun cevap verme.
- Kesin bilgi olmayan ruhsal veya sembolik yorumları olasılık olarak sun.
- Kullanıcıya tepeden konuşma.
- Cevabın sonunda yalnızca gerçekten faydalıysa bir soru sor.
Kullanıcının dilinde cevap ver.
`.trim();
}

/**
 * Build a system prompt for a named profile.
 * Priority: style override > user intent > founder context > persona modules.
 * @param {{ profile?: PromptProfile, mode?: string, currentDate?: string, tarotIntent?: import('./symbolic-synthesis.js').TarotSpreadIntent|null, founderProfile?: import('./founder-knowledge.js').FounderProfile|null, founderSession?: import('./founder-identity.js').FounderSession|null, message?: string }} [options]
 * @returns {string} Empty string for shorts/generic — caller must supply the prompt.
 */
export function buildAtlasSystemPrompt(options = {}) {
  const profile = options.profile ?? 'conversational';
  const modules = PROMPT_PROFILE_MODULES[profile];

  if (!modules || modules.length === 0) {
    return '';
  }

  const founderSession =
    options.founderSession ??
    (options.founderProfile
      ? {
          knowledge: options.founderProfile,
          biography: getFounderBiographyProfile(options.founderProfile.id),
          userId: '',
          resolved: true,
        }
      : null);

  const gateSession = founderSession?.knowledge ? founderSession : null;
  const gateOpen =
    shouldInjectFounderContextBlocks(options.message ?? '', gateSession, {
      isGroup: options.isGroup === true,
    });
  // Explicit flags force injection (unit tests / callers that already gated).
  // Otherwise both compact identity and heavy blocks share the context gate.
  const injectFounderIdentity =
    options.injectFounderIdentity === true ||
    options.injectFounderHeavy === true ||
    (options.injectFounderIdentity !== false &&
      options.injectFounderHeavy !== false &&
      gateOpen);
  const injectFounderHeavy =
    options.injectFounderHeavy === true ||
    (options.injectFounderHeavy !== false && (gateOpen || options.injectFounderIdentity === true));

  const base = loadAtlasModules(modules);
  const tarotExtra =
    options.tarotIntent?.active && !modules.includes(TAROT_SPREAD_MODULE)
      ? `\n\n---\n\n${loadAtlasModule(TAROT_SPREAD_MODULE)}`
      : '';

  const founderSystemSection =
    injectFounderHeavy && founderSession?.knowledge
      ? buildFounderSystemPromptSection(founderSession)
      : '';

  // Compact "Kurucu Oturumu Aktif" only when identity context gate is open.
  const runtime = buildRuntimeRules({
    currentDate: options.currentDate,
    mode: options.mode,
    profile,
    tarotIntent: options.tarotIntent,
    founderSession: injectFounderIdentity && gateSession ? gateSession : null,
    founderProfile:
      injectFounderIdentity && founderSession?.knowledge ? options.founderProfile : null,
  });

  const styleOverride = buildConversationStyleRuntimeBlock();

  const parts = [styleOverride, '---', base + tarotExtra];
  if (founderSystemSection) {
    parts.push('---', founderSystemSection);
  }
  if (options.includePrivacyInstructions !== false) {
    parts.push('---', PRIVACY_SYSTEM_INSTRUCTION);
    parts.push('---', IDENTITY_SAFETY_SYSTEM_RULES);
    parts.push('---', SPEAKER_ATTRIBUTION_SYSTEM_RULES);
    parts.push('---', ABJAD_VERIFICATION_SYSTEM_RULES);
  }
  parts.push('---', runtime);
  parts.push('---', styleOverride);
  return parts.join('\n\n');
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

// ═══════════════════════════════════════════════════════════════════════
// Author Profile — Lara Writing Style Engine
//
// Persistent author voice for Atlas content + commentary.
// Separate from Founder Profile (identity) and user_memory.json.
// Style is learned from permitted examples; text is never copied verbatim.
// ═══════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTHOR_DIR = join(__dirname, '..', 'knowledge', 'author-profile');
const REGISTRY_FILE = join(AUTHOR_DIR, 'author-profile.json');
const STYLE_RULES_FILE = join(AUTHOR_DIR, 'style-rules.json');
const VOICE_PROFILE_FILE = join(AUTHOR_DIR, 'voice-profile.json');
const EXAMPLES_DIR = join(AUTHOR_DIR, 'writing-examples');
const PATTERNS_DIR = join(AUTHOR_DIR, 'symbolic-patterns');

/** Bump when author runtime block / banned phrases / outbound guard change. */
export const AUTHOR_PROFILE_VERSION = 'atlas-author-profile-v1.1';

/**
 * @typedef {Object} AuthorProfileMeta
 * @property {string} id
 * @property {string} displayName
 * @property {string} role
 * @property {string[]} sources
 * @property {string[]} contentDomains
 * @property {string} principle
 * @property {string} defaultTone
 * @property {string} notes
 */

/**
 * @typedef {Object} AuthorProfileBundle
 * @property {number} version
 * @property {string} activeProfileId
 * @property {AuthorProfileMeta|null} profile
 * @property {object|null} styleRules
 * @property {object|null} voiceProfile
 * @property {object[]} writingExamples
 * @property {object[]} symbolicPatterns
 * @property {string[]} forbiddenMechanicalFrames
 */

/** @type {AuthorProfileBundle|null} */
let cache = null;

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`[AuthorProfile] Failed to load ${filePath}:`, err.message);
    return null;
  }
}

/**
 * @param {string} dirPath
 * @param {'examples'|'patterns'|'items'} kind
 */
function loadJsonFilesFromDir(dirPath, kind = 'items') {
  if (!existsSync(dirPath)) return { items: [], forbiddenMechanicalFrames: [] };
  const items = [];
  const forbiddenMechanicalFrames = [];
  for (const name of readdirSync(dirPath)) {
    if (!name.endsWith('.json')) continue;
    const raw = readJson(join(dirPath, name));
    if (!raw) continue;
    forbiddenMechanicalFrames.push(...asStringArray(raw.forbiddenMechanicalFrames));
    if (kind === 'examples' && Array.isArray(raw.examples)) items.push(...raw.examples);
    else if (kind === 'patterns' && Array.isArray(raw.patterns)) items.push(...raw.patterns);
    else if (Array.isArray(raw)) items.push(...raw);
    else if (!raw.examples && !raw.patterns) items.push(raw);
  }
  return { items, forbiddenMechanicalFrames };
}

function normalizeProfileMeta(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: String(raw.id ?? 'lara-author'),
    displayName: String(raw.displayName ?? 'Lara'),
    role: String(raw.role ?? 'default-author-voice'),
    sources: asStringArray(raw.sources),
    contentDomains: asStringArray(raw.contentDomains),
    principle: String(raw.principle ?? ''),
    defaultTone: String(raw.defaultTone ?? ''),
    notes: String(raw.notes ?? ''),
  };
}

/**
 * @returns {{ ok: boolean, profileId?: string, error?: string }}
 */
export function initializeAuthorProfile() {
  try {
    const registry = readJson(REGISTRY_FILE) ?? { version: 1, activeProfileId: 'lara-author', profiles: [] };
    const activeId = String(registry.activeProfileId ?? 'lara-author');
    const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
    const profile =
      normalizeProfileMeta(profiles.find((p) => p?.id === activeId)) ||
      normalizeProfileMeta(profiles[0]) ||
      normalizeProfileMeta({ id: activeId, displayName: 'Lara' });

    const examplesPack = loadJsonFilesFromDir(EXAMPLES_DIR, 'examples');
    const patternsPack = loadJsonFilesFromDir(PATTERNS_DIR, 'patterns');

    cache = {
      version: Number(registry.version) || 1,
      activeProfileId: profile.id,
      profile,
      styleRules: readJson(STYLE_RULES_FILE),
      voiceProfile: readJson(VOICE_PROFILE_FILE),
      writingExamples: examplesPack.items,
      symbolicPatterns: patternsPack.items,
      forbiddenMechanicalFrames: patternsPack.forbiddenMechanicalFrames,
    };

    return { ok: true, profileId: profile.id };
  } catch (err) {
    cache = {
      version: 1,
      activeProfileId: 'lara-author',
      profile: normalizeProfileMeta({ id: 'lara-author', displayName: 'Lara' }),
      styleRules: null,
      voiceProfile: null,
      writingExamples: [],
      symbolicPatterns: [],
      forbiddenMechanicalFrames: [],
    };
    console.error('[AuthorProfile] Init failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/** Reload JSON from disk (after adding new writing examples). */
export function reloadAuthorProfile() {
  cache = null;
  return initializeAuthorProfile();
}

/** @returns {AuthorProfileBundle} */
export function getAuthorProfileBundle() {
  if (!cache) initializeAuthorProfile();
  return /** @type {AuthorProfileBundle} */ (cache);
}

/** @returns {AuthorProfileMeta|null} */
export function getActiveAuthorProfile() {
  return getAuthorProfileBundle().profile;
}

function listOrDash(items, limit = 8) {
  const list = asStringArray(items).slice(0, limit);
  return list.length ? list.map((i) => `- ${i}`).join('\n') : '- (tanımlı değil)';
}

function collectForbiddenMechanicalPhrases(bundle) {
  const fromVoice = asStringArray(bundle.voiceProfile?.tarotVoice?.forbiddenOpeners);
  const fromPatternFiles = asStringArray(bundle.forbiddenMechanicalFrames);
  const defaults = [
    'klasik tarot destesinden',
    'classic tarot destesinden',
    'sembolik olarak üç kart seçiyorum',
    'sembolik olarak kart seçiyorum',
    'kartları karıştırıyorum',
    'desteyi karıştırıyorum',
    'şimdi kart çekiyorum',
    'simdi kart cekiyorum',
    'üç kart çekiyorum',
    'uc kart cekiyorum',
  ];
  return [...new Set([...fromVoice, ...fromPatternFiles, ...defaults])];
}

/**
 * Phrases that must not appear in tarot / procedural openings.
 * @returns {string[]}
 */
export function getForbiddenMechanicalPhrases() {
  return collectForbiddenMechanicalPhrases(getAuthorProfileBundle());
}

/**
 * @param {string} reply
 * @returns {boolean}
 */
export function containsForbiddenMechanicalPhrase(reply) {
  const text = String(reply ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC');
  if (!text) return false;
  return getForbiddenMechanicalPhrases().some((phrase) => {
    const p = String(phrase)
      .toLocaleLowerCase('tr-TR')
      .normalize('NFC');
    return p && text.includes(p);
  });
}

/**
 * Normalize for phrase matching.
 * @param {string} value
 */
function normalizeAuthorText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC');
}

/**
 * Strip mechanical procedure sentences from outbound replies.
 * Style is learned; procedure narration is never allowed in Lara voice.
 *
 * @param {string} reply
 * @param {{ tarotActive?: boolean }} [options]
 * @returns {{ reply: string, changed: boolean, removed: string[] }}
 */
export function applyAuthorVoiceGuard(reply, _options = {}) {
  const original = String(reply ?? '');
  const trimmed = original.trim();
  if (!trimmed || !containsForbiddenMechanicalPhrase(trimmed)) {
    return { reply: original, changed: false, removed: [] };
  }

  const phrases = getForbiddenMechanicalPhrases()
    .map((p) => normalizeAuthorText(p))
    .filter(Boolean);
  const removed = [];

  const paragraphs = trimmed.split(/\n+/);
  const cleanedParagraphs = [];

  for (const para of paragraphs) {
    const sentences = para
      .split(/(?<=[.!?…])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const kept = [];
    for (const sentence of sentences) {
      const lower = normalizeAuthorText(sentence);
      const hit = phrases.some((p) => lower.includes(p));
      if (hit) {
        removed.push(sentence);
        continue;
      }
      kept.push(sentence);
    }
    if (kept.length) cleanedParagraphs.push(kept.join(' '));
  }

  let next = cleanedParagraphs.join('\n\n').trim();
  if (!next) {
    // Never invent a reading; keep original if stripping would empty the reply.
    return { reply: original, changed: false, removed, emptied: true };
  }

  // Preserve a trailing newline style only when the original had one and content remains.
  if (original.endsWith('\n') && !next.endsWith('\n')) {
    next = `${next}\n`;
  }

  return {
    reply: next,
    changed: next.trim() !== trimmed,
    removed,
  };
}

/**
 * High-priority author voice block for system prompts.
 * Applied for all content/analysis modes as default Lara tone.
 */
export function buildAuthorProfileRuntimeBlock(options = {}) {
  const bundle = getAuthorProfileBundle();
  const profile = bundle.profile;
  const style = bundle.styleRules ?? {};
  const voice = bundle.voiceProfile ?? {};
  const tarotActive = options.tarotActive === true;
  const mode = options.mode ?? 'conversational';

  const preferredOpeners = asStringArray(voice.tarotVoice?.preferredOpeners).slice(0, 5);
  const forbiddenOpeners = asStringArray(voice.tarotVoice?.forbiddenOpeners).slice(0, 8);
  const patterns = bundle.symbolicPatterns
    .filter((p) => p?.name || p?.frame)
    .slice(0, 6)
    .map((p) => `- ${p.name || p.id}: ${p.frame || ''}`)
    .join('\n');
  const exampleNotes = bundle.writingExamples
    .slice(0, 4)
    .map((ex) => {
      const notes = asStringArray(ex.styleNotes).slice(0, 3).join('; ');
      return `- ${ex.domain || ex.id}: ${notes || ex.styleNotes || ''}`;
    })
    .join('\n');

  const tarotSection = tarotActive
    ? `
### Tarot anlatımı (zorunlu)
- Mekanik kart çekme / karıştırma / "desteden seçiyorum" cümleleri YASAK.
- Kart sonucunu doğrudan doğal anlatımla sun.
- Tercih edilen açılışlar:
${listOrDash(preferredOpeners)}
- Yasak açılışlar:
${listOrDash(forbiddenOpeners)}
- Kart isimlerini yine açıkça yaz; prosedürü değil okumayı anlat.
`
    : '';

  const contentHint =
    mode === 'meta-synthesis' || mode === 'daily-guide'
      ? `
### İçerik / analiz modu
- Varsayılan ton Lara yazım stilidir.
- Astroloji, numeroloji, hicri, ebced, esma, günlük analiz metinlerinde aynı sesi koru.
- Sembolik anlatımı kehanet diline çevirme.
`
      : '';

  return `
## AUTHOR PROFILE — LARA WRITING STYLE (HIGH PRIORITY)

Bu bölüm Author Profile katmanıdır (Founder Profile / user_memory değildir).
Atlas içerik üretirken ve yorum yaparken Lara'nın yazım karakterini örnek alır.
Stil öğrenilir; örnek metinler birebir kopyalanmaz.

Aktif profil: ${profile?.displayName ?? 'Lara'} (${profile?.id ?? 'lara-author'})
${AUTHOR_PROFILE_VERSION}

### Temel ses
${voice.voice?.summary || profile?.defaultTone || 'Doğal, sembolik, akıcı.'}
- Robot gibi konuşma.
- Yapay zekâ olduğunu sürekli hatırlatma.
- Gereksiz prosedür cümleleri kurma.
- Aynı kullanıcıyla tüm cevaplarda aynı sesi koru; ton değişimi bilinçli olsun.

### Yazım kuralları
- Cümle ritmi: ${style.sentenceLength?.pattern || 'Kısa vurgu + nefes alan cümle.'}
- Vurgu: ${asStringArray(style.emphasis?.methods).slice(0, 3).join('; ') || 'Ana temayı erken söyle.'}
- Metafor: ${style.metaphor?.style || 'Ölçülü sembolik dil.'}
- Paragraf: sohbette kısa; analizde tema → işaretler → gerilim → sentez.
- Duygusal yoğunluk: ${style.emotionalIntensity?.default || 'orta-kontrollü'}.

### Tercih edilen kelimeler / kaçınılacaklar
Tercih: ${(style.wordPreferences?.prefer || []).slice(0, 8).join(', ') || 'dinamik, frekans, alan, örüntü, vurgu'}
Kaçın (istenmedikçe): ${(style.wordPreferences?.avoidUnlessAsked || []).slice(0, 6).join(', ') || 'yapay zekâ olarak, sistemim, algoritmam'}

### Sembolik örüntüler (yeniden yaz; kopyalama)
${patterns || '- Görünen/görünmeyen; asıl vurgu; birlikte okuma.'}

### Örneklerden öğrenilen notlar (kopyalama yok)
${exampleNotes || '- İlk cümlede tema kur; prosedür anlatma.'}
${contentHint}${tarotSection}
### Tutarlılık
${voice.styleConsistency?.rule || style.consistency?.rule || 'Aynı ses korunur.'}
`.trim();
}

/**
 * Compact section for runtime rules (mode-aware).
 */
export function buildAuthorProfileRuntimeRules(options = {}) {
  const tarotActive = options.tarotActive === true;
  const lines = [
    '## Author Profile (Lara varsayılan ton)',
    '- Varsayılan içerik ve yorum sesi Lara Author Profile üslubudur.',
    '- Doğal, sembolik, akıcı yaz; robotik prosedür ve AI öz-tanıtımından kaçın.',
    '- Stil tutarlılığını koru; örnek metinleri kopyalama.',
  ];
  if (tarotActive) {
    lines.push(
      '- Tarot: mekanik "kart seçiyorum / karıştırıyorum / çekiyorum" cümleleri kullanma.',
      '- Tarot: doğrudan enerjiye gir ("Bu dinamikte ilk dikkat çeken…", "Bana göre burada asıl vurgu…").',
    );
  }
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════
// Persona Engine v1 — Lara Cognitive Model & Adaptive Author System
//
// File-based, modular, LLM-independent knowledge layer.
// Wraps Author Profile + multi-voice + seed reasoning/feedback modules.
// Does not replace conversation-style or user_memory; composes with them.
// ═══════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  AUTHOR_PROFILE_VERSION,
  applyAuthorVoiceGuard,
  buildAuthorProfileRuntimeBlock,
  getActiveAuthorProfile,
  initializeAuthorProfile,
  reloadAuthorProfile,
} from './author-profile.js';
import {
  resolveApplicableFeedback,
  processPersonaFeedbackLearning,
  PERSONA_FEEDBACK_VERSION,
} from './persona-feedback/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONA_DIR = join(__dirname, '..', 'knowledge', 'persona-engine');
const REGISTRY_FILE = join(PERSONA_DIR, 'persona-engine.json');
const VOICE_DIR = join(PERSONA_DIR, 'voice');

/** Bump when persona runtime composition / injection order changes. */
export const PERSONA_ENGINE_VERSION = 'persona-v1.1';

/**
 * @typedef {Object} PersonaVoice
 * @property {string} id
 * @property {string} [displayName]
 * @property {string} [tone]
 * @property {string} [register]
 * @property {string[]} [domains]
 * @property {string[]} [channels]
 * @property {string[]} [prefer]
 * @property {string[]} [avoid]
 */

/**
 * @typedef {Object} PersonaEngineBundle
 * @property {object|null} registry
 * @property {Map<string, PersonaVoice>} voices
 * @property {object|null} reasoning
 * @property {object|null} preferences
 * @property {object|null} decisionPatterns
 * @property {object|null} rejectedPatterns
 * @property {object|null} editingSignals
 * @property {object|null} symbolicThinking
 */

/** @type {PersonaEngineBundle|null} */
let cache = null;

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`[PersonaEngine] Failed to load ${filePath}:`, err.message);
    return null;
  }
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function loadVoices() {
  /** @type {Map<string, PersonaVoice>} */
  const voices = new Map();
  if (!existsSync(VOICE_DIR)) return voices;
  for (const name of readdirSync(VOICE_DIR)) {
    if (!name.endsWith('.json')) continue;
    const raw = readJson(join(VOICE_DIR, name));
    if (!raw?.id) continue;
    voices.set(String(raw.id), {
      id: String(raw.id),
      displayName: String(raw.displayName ?? raw.id),
      tone: String(raw.tone ?? ''),
      register: String(raw.register ?? ''),
      domains: asStringArray(raw.domains),
      channels: asStringArray(raw.channels),
      prefer: asStringArray(raw.prefer),
      avoid: asStringArray(raw.avoid),
    });
  }
  return voices;
}

/**
 * @returns {{ ok: boolean, engineId?: string, error?: string }}
 */
export function initializePersonaEngine() {
  try {
    initializeAuthorProfile();
    cache = {
      registry: readJson(REGISTRY_FILE),
      voices: loadVoices(),
      reasoning: readJson(join(PERSONA_DIR, 'reasoning', 'reasoning-v1.json')),
      preferences: readJson(join(PERSONA_DIR, 'preferences', 'editorial-preferences.json')),
      decisionPatterns: readJson(join(PERSONA_DIR, 'decision-patterns', 'decision-patterns.json')),
      rejectedPatterns: readJson(join(PERSONA_DIR, 'feedback', 'rejected-patterns.json')),
      editingSignals: readJson(join(PERSONA_DIR, 'editing', 'editing-signals.json')),
      symbolicThinking: readJson(
        join(PERSONA_DIR, 'symbolic-thinking', 'symbolic-ecosystem.json'),
      ),
    };
    return { ok: true, engineId: cache.registry?.engineId ?? PERSONA_ENGINE_VERSION };
  } catch (err) {
    cache = {
      registry: null,
      voices: new Map(),
      reasoning: null,
      preferences: null,
      decisionPatterns: null,
      rejectedPatterns: null,
      editingSignals: null,
      symbolicThinking: null,
    };
    console.error('[PersonaEngine] Init failed:', err.message);
    return { ok: false, error: err.message };
  }
}

export function reloadPersonaEngine() {
  cache = null;
  reloadAuthorProfile();
  return initializePersonaEngine();
}

/** @returns {PersonaEngineBundle} */
export function getPersonaEngineBundle() {
  if (!cache) initializePersonaEngine();
  return /** @type {PersonaEngineBundle} */ (cache);
}

export function getPersonaEngineStatus() {
  const bundle = getPersonaEngineBundle();
  const registry = bundle.registry;
  return {
    version: PERSONA_ENGINE_VERSION,
    engineId: registry?.engineId ?? PERSONA_ENGINE_VERSION,
    status: registry?.status ?? 'unknown',
    voiceCount: bundle.voices.size,
    authorProfileId: getActiveAuthorProfile()?.id ?? null,
    authorProfileVersion: AUTHOR_PROFILE_VERSION,
    feedbackVersion: PERSONA_FEEDBACK_VERSION,
    modules: registry?.modules ?? {},
  };
}

/**
 * Resolve voice by channel / domain / explicit id.
 * @param {{ voiceId?: string, channel?: string, domain?: string, mode?: string }} [options]
 * @returns {PersonaVoice|null}
 */
export function resolvePersonaVoice(options = {}) {
  const bundle = getPersonaEngineBundle();
  const voices = bundle.voices;
  if (!voices.size) return null;

  if (options.voiceId && voices.has(options.voiceId)) {
    return voices.get(options.voiceId) ?? null;
  }

  const channel = String(options.channel ?? '').toLowerCase();
  if (channel) {
    for (const voice of voices.values()) {
      if (voice.channels.some((c) => c.toLowerCase() === channel)) return voice;
      if (voice.domains.some((d) => d.toLowerCase() === channel)) return voice;
      if (voice.id === channel) return voice;
    }
  }

  const domain = String(options.domain ?? options.mode ?? '').toLowerCase();
  if (domain) {
    if (domain.includes('tarot') || domain.includes('astro')) {
      return voices.get('astrolojik-akil') ?? voices.get('atlas-analysis') ?? null;
    }
    if (domain.includes('meta') || domain.includes('daily') || domain.includes('analysis')) {
      return voices.get('atlas-analysis') ?? null;
    }
    if (domain.includes('blog') || domain.includes('simya')) {
      return voices.get('cosmic-simya') ?? null;
    }
    for (const voice of voices.values()) {
      if (voice.domains.some((d) => d.toLowerCase() === domain || domain.includes(d.toLowerCase()))) {
        return voice;
      }
    }
  }

  const defaultId = bundle.registry?.activeVoiceId ?? 'atlas-analysis';
  return voices.get(defaultId) ?? voices.values().next().value ?? null;
}

function listOrDash(items, limit = 6) {
  const list = asStringArray(items).slice(0, limit);
  return list.length ? list.map((i) => `- ${i}`).join('\n') : '- (tanımlı değil)';
}

/**
 * Compact persona shell (version, safety, module awareness).
 */
export function buildPersonaEngineHeaderBlock() {
  const status = getPersonaEngineStatus();
  return `
## PERSONA ENGINE (${PERSONA_ENGINE_VERSION})

Bu blok Lara Cognitive Model / Adaptive Author System katmanıdır.
Author Profile merkezdedir. Stil öğrenilir; metin kopyalanmaz.
Kişisel facts (user_memory) ile editoryal öğrenme ayrılır.
Kimlik uydurma, kullanıcı adına karar, kesin kader hükmü yok — yalnızca davranış ve stil.

Aktif motor: ${status.engineId} (${status.status})
Author Profile: ${status.authorProfileId ?? 'lara-author'} / ${status.authorProfileVersion}
`.trim();
}

/**
 * Selected voice runtime block.
 * @param {{ voiceId?: string, channel?: string, domain?: string, mode?: string }} [options]
 */
export function buildPersonaVoiceRuntimeBlock(options = {}) {
  const voice = resolvePersonaVoice(options);
  if (!voice) {
    return '## Voice\n- Varsayılan Lara analiz sesi (voice profili yüklenemedi).';
  }
  return `
## Voice — ${voice.displayName || voice.id} (${voice.id})

Ton: ${voice.tone || 'Lara varsayılan sesi'}
Register: ${voice.register || 'Doğal, sembolik, akıcı'}
Tercih: ${(voice.prefer || []).slice(0, 6).join(', ') || '—'}
Kaçın: ${(voice.avoid || []).slice(0, 6).join(', ') || '—'}
`.trim();
}

/**
 * Seed reasoning + decision + rejected pattern hints.
 */
export function buildPersonaReasoningRuntimeBlock() {
  const bundle = getPersonaEngineBundle();
  const patterns = Array.isArray(bundle.reasoning?.patterns) ? bundle.reasoning.patterns : [];
  const decisions = Array.isArray(bundle.decisionPatterns?.patterns)
    ? bundle.decisionPatterns.patterns
    : [];
  const rejected = Array.isArray(bundle.rejectedPatterns?.patterns)
    ? bundle.rejectedPatterns.patterns
    : [];
  const prefs = bundle.preferences?.editorial ?? {};

  const reasonLines = patterns
    .slice(0, 5)
    .map((p) => `- ${p.id}: ${p.rule}`)
    .join('\n');
  const decisionLines = decisions
    .slice(0, 5)
    .map((p) => `- ${p.id}: ${p.prefer || `kaçın → ${p.avoid}`}`)
    .join('\n');
  const rejectedLines = rejected
    .slice(0, 4)
    .map((p) => `- ${p.id}: ${p.summary}`)
    .join('\n');

  return `
## Reasoning & Decision Patterns (seed)

### Düşünme
${reasonLines || '- Temayı indir; katmanları ilişkilendir; sentezle.'}

### Karar alışkanlıkları
${decisionLines || '- Minimal, tok, robotik olmayan dil.'}

### Reddedilen örüntüler (tekrarlama)
${rejectedLines || '- Mekanik tarot / AI öz-tanıtım'}

### Editoryal tercihler
- Robotik dil: ${prefs.roboticLanguage === false ? 'hayır' : 'bilinmiyor'}
- Fazla emoji: ${prefs.excessEmoji === false ? 'hayır' : 'bilinmiyor'}
- Gereksiz açıklama: ${prefs.unnecessaryExplanation === false ? 'hayır' : 'bilinmiyor'}
- Kısa başlık / yüksek estetik: ${prefs.shortTitles !== false && prefs.highAesthetic !== false ? 'evet' : 'bilinmiyor'}
`.trim();
}

/**
 * Full persona stack for system prompt (Voice + Author + Reasoning + scoped Feedback).
 * Conversation style remains a separate higher-priority override.
 *
 * @param {{
 *   tarotActive?: boolean,
 *   mode?: string,
 *   channel?: string,
 *   domain?: string,
 *   voiceId?: string,
 *   brand?: string,
 *   conversationId?: string,
 *   feedbackResolution?: object|null,
 * }} [options]
 */
export function buildPersonaEngineRuntimeBlock(options = {}) {
  const header = buildPersonaEngineHeaderBlock();
  const voice = buildPersonaVoiceRuntimeBlock(options);
  const author = buildAuthorProfileRuntimeBlock({
    tarotActive: options.tarotActive === true,
    mode: options.mode ?? 'conversational',
  });
  const reasoning = buildPersonaReasoningRuntimeBlock();

  const resolvedVoice = resolvePersonaVoice(options);
  const resolution =
    options.feedbackResolution ??
    resolveApplicableFeedback({
      activeVoice: options.voiceId || resolvedVoice?.id,
      brand: options.brand || options.domain || null,
      channel: options.channel || null,
      contentType: options.domain || null,
      taskType: options.mode || null,
      mode: options.mode || null,
      conversationId: options.conversationId || null,
      limit: 8,
    });

  const feedbackBlock = resolution.promptBlock
    ? resolution.promptBlock
    : '## Active Editorial Feedback (scoped)\n- (aktif scoped feedback yok)';

  return [header, voice, author, reasoning, feedbackBlock].join('\n\n---\n\n');
}

/**
 * Compact rules for runtime section.
 */
export function buildPersonaEngineRuntimeRules(options = {}) {
  const voice = resolvePersonaVoice(options);
  const resolution = resolveApplicableFeedback({
    activeVoice: options.voiceId || voice?.id,
    brand: options.brand || options.domain || null,
    channel: options.channel || null,
    mode: options.mode || null,
    conversationId: options.conversationId || null,
    limit: 5,
  });
  const lines = [
    '## Persona Engine (Lara)',
    `- ${PERSONA_ENGINE_VERSION}: varsayılan içerik/yorum sesi Lara Author Profile + seçili voice.`,
    `- Aktif voice: ${voice?.id ?? 'atlas-analysis'}.`,
    `- Feedback: ${PERSONA_FEEDBACK_VERSION} (${resolution.appliedFeedbackIds.length} aktif kural).`,
    '- Stil öğrenilir; örnek metin kopyalanmaz.',
    '- Editoryal öğrenme kişisel facts ile karıştırılmaz.',
  ];
  if (options.tarotActive) {
    lines.push('- Tarot: mekanik prosedür cümlesi yok; doğrudan enerjiye gir.');
  }
  if (resolution.promptRules.length) {
    lines.push('- Scoped feedback:');
    lines.push(...resolution.promptRules.slice(0, 5));
  }
  return lines.join('\n');
}

/**
 * Capture + persist feedback from a user turn; returns debug-safe result.
 */
export function ingestPersonaFeedbackTurn(input = {}) {
  return processPersonaFeedbackLearning(input);
}

// Re-export Phase 2 learning entry for callers
export { processPersonaFeedbackLearning, resolveApplicableFeedback, PERSONA_FEEDBACK_VERSION };

/**
 * Outbound persona guards (Phase 1: wraps Author Profile mechanical guard).
 * @param {string} reply
 * @param {{ tarotActive?: boolean }} [options]
 */
export function applyPersonaGuards(reply, options = {}) {
  const authorGuard = applyAuthorVoiceGuard(reply, options);
  return {
    reply: authorGuard.reply,
    changed: Boolean(authorGuard.changed),
    removed: authorGuard.removed ?? [],
    guards: ['author-mechanical', ...(authorGuard.changed ? ['mechanical-stripped'] : [])],
  };
}

/**
 * Detect editorial revision signals in user text (Phase 1: detect only).
 * @param {string} message
 * @returns {{ matched: boolean, signals: object[] }}
 */
export function detectEditingSignals(message) {
  const text = String(message ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC');
  if (!text.trim()) return { matched: false, signals: [] };
  const bundle = getPersonaEngineBundle();
  const signals = Array.isArray(bundle.editingSignals?.signals)
    ? bundle.editingSignals.signals
    : [];
  const hits = [];
  for (const signal of signals) {
    const phrases = asStringArray(signal.phrases);
    if (phrases.some((p) => text.includes(p.toLocaleLowerCase('tr-TR')))) {
      hits.push(signal);
    }
  }
  return { matched: hits.length > 0, signals: hits };
}

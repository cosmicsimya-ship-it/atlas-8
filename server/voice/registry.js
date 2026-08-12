/**
 * Central Atlas voice registry.
 * Logical voice ids (lara, …) map to provider-specific IDs via config/env — never hardcode secrets.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import {
  SUPPORTED_LANGUAGES,
  VOICE_SOURCE_DIR,
  getVoiceConfig,
  loadRegistryFile,
  resolveEnvString,
} from './config.js';

/**
 * @typedef {object} AtlasVoice
 * @property {string} id
 * @property {string} displayName
 * @property {string} provider
 * @property {string} [providerVoiceId]
 * @property {Record<string, string>} [providerVoiceIds]
 * @property {string[]} languages
 * @property {string} [gender]
 * @property {string} [role]
 * @property {boolean} enabled
 * @property {boolean} [isDefault]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * Built-in fallback when registry file is missing.
 * @returns {AtlasVoice[]}
 */
function builtInVoices() {
  const cfg = getVoiceConfig();
  return [
    {
      id: 'lara',
      displayName: 'Lara',
      provider: cfg.providerId === 'openai' ? 'openai' : 'elevenlabs',
      languages: [...SUPPORTED_LANGUAGES],
      gender: 'female',
      role: 'founder',
      enabled: true,
      isDefault: true,
      providerVoiceId: cfg.elevenlabs.laraVoiceId || undefined,
      providerVoiceIds: {
        ...(cfg.elevenlabs.laraVoiceIdTr
          ? { 'tr-TR': cfg.elevenlabs.laraVoiceIdTr }
          : {}),
        ...(cfg.elevenlabs.laraVoiceIdEn
          ? { 'en-US': cfg.elevenlabs.laraVoiceIdEn, 'en-GB': cfg.elevenlabs.laraVoiceIdEn }
          : {}),
      },
      metadata: {
        masterAsset: 'voice-assets/source/lara-master.mp3',
        identity: 'founder-default',
      },
    },
  ];
}

/**
 * @param {object} raw
 * @returns {AtlasVoice|null}
 */
function normalizeVoiceEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  if (!id) return null;

  const languages = Array.isArray(raw.languages)
    ? raw.languages.map((l) => String(l).trim()).filter(Boolean)
    : [...SUPPORTED_LANGUAGES];

  /** @type {Record<string, string>} */
  const providerVoiceIds = {};
  if (raw.providerVoiceIds && typeof raw.providerVoiceIds === 'object') {
    for (const [lang, val] of Object.entries(raw.providerVoiceIds)) {
      const resolved = resolveEnvString(val);
      if (resolved) providerVoiceIds[lang] = resolved;
    }
  }

  const providerVoiceId = resolveEnvString(raw.providerVoiceId) || undefined;

  return {
    id,
    displayName: String(raw.displayName || id).trim() || id,
    provider: String(raw.provider || getVoiceConfig().providerId).trim().toLowerCase(),
    providerVoiceId,
    providerVoiceIds: Object.keys(providerVoiceIds).length ? providerVoiceIds : undefined,
    languages,
    gender: raw.gender ? String(raw.gender) : undefined,
    role: raw.role ? String(raw.role) : undefined,
    enabled: raw.enabled !== false,
    isDefault: Boolean(raw.isDefault),
    metadata: raw.metadata && typeof raw.metadata === 'object' ? { ...raw.metadata } : undefined,
  };
}

/**
 * @returns {AtlasVoice[]}
 */
export function listRegistryVoices() {
  const file = loadRegistryFile();
  const fromFile = Array.isArray(file?.voices)
    ? file.voices.map(normalizeVoiceEntry).filter(Boolean)
    : [];
  const voices = fromFile.length ? fromFile : builtInVoices();

  // Overlay live env for Lara when registry placeholders were empty.
  const cfg = getVoiceConfig();
  return voices.map((v) => {
    if (v.id !== 'lara') return v;
    const providerVoiceIds = { ...(v.providerVoiceIds || {}) };
    if (!providerVoiceIds['tr-TR'] && cfg.elevenlabs.laraVoiceIdTr) {
      providerVoiceIds['tr-TR'] = cfg.elevenlabs.laraVoiceIdTr;
    }
    if (!providerVoiceIds['en-US'] && cfg.elevenlabs.laraVoiceIdEn) {
      providerVoiceIds['en-US'] = cfg.elevenlabs.laraVoiceIdEn;
    }
    if (!providerVoiceIds['en-GB'] && cfg.elevenlabs.laraVoiceIdEn) {
      providerVoiceIds['en-GB'] = cfg.elevenlabs.laraVoiceIdEn;
    }
    const providerVoiceId =
      v.providerVoiceId ||
      cfg.elevenlabs.laraVoiceId ||
      (cfg.providerId === 'openai' || v.provider === 'openai'
        ? cfg.openai.defaultVoice
        : undefined);

    /** Active TTS backend may remint logical Lara onto openai/elevenlabs via ATLAS_TTS_PROVIDER */
    let provider = v.provider;
    if (cfg.providerId === 'openai' || cfg.providerId === 'elevenlabs') {
      provider = cfg.providerId;
    }

    return {
      ...v,
      provider,
      providerVoiceId: providerVoiceId || undefined,
      providerVoiceIds: Object.keys(providerVoiceIds).length ? providerVoiceIds : undefined,
    };
  });
}

/**
 * @param {string} voiceId
 * @returns {AtlasVoice|null}
 */
export function getVoice(voiceId) {
  const id = String(voiceId || '').trim();
  if (!id) return null;
  return listRegistryVoices().find((v) => v.id === id && v.enabled) || null;
}

/**
 * @returns {AtlasVoice|null}
 */
export function getDefaultVoice() {
  const voices = listRegistryVoices().filter((v) => v.enabled);
  return voices.find((v) => v.isDefault) || voices[0] || null;
}

/**
 * Public listing — never includes provider secrets / voice IDs.
 * @returns {object[]}
 */
export function listPublicVoices() {
  return listRegistryVoices()
    .filter((v) => v.enabled)
    .map((v) => ({
      id: v.id,
      displayName: v.displayName,
      languages: [...v.languages],
      gender: v.gender ?? null,
      role: v.role ?? null,
      isDefault: Boolean(v.isDefault),
      configured: isVoiceConfigured(v),
    }));
}

/**
 * Resolve the provider-native voice id for a logical Atlas voice + language.
 * @param {AtlasVoice} voice
 * @param {string} language
 * @returns {string|null}
 */
export function resolveProviderVoiceId(voice, language) {
  if (!voice) return null;
  const lang = String(language || '').trim();
  const perLang = voice.providerVoiceIds?.[lang];
  if (perLang) return perLang;
  if (voice.providerVoiceId) return voice.providerVoiceId;

  const cfg = getVoiceConfig();
  if (voice.id === 'lara') {
    if (lang.startsWith('tr') && cfg.elevenlabs.laraVoiceIdTr) return cfg.elevenlabs.laraVoiceIdTr;
    if (lang.startsWith('en') && cfg.elevenlabs.laraVoiceIdEn) return cfg.elevenlabs.laraVoiceIdEn;
    if (cfg.elevenlabs.laraVoiceId) return cfg.elevenlabs.laraVoiceId;
    if (voice.provider === 'openai' && cfg.openai.defaultVoice) return cfg.openai.defaultVoice;
  }
  return null;
}

/**
 * @param {AtlasVoice} voice
 * @returns {boolean}
 */
export function isVoiceConfigured(voice) {
  if (!voice?.enabled) return false;
  const cfg = getVoiceConfig();
  if (cfg.providerId === 'mock' || cfg.dryRun) return true;

  if (voice.provider === 'elevenlabs' || cfg.providerId === 'elevenlabs') {
    if (!cfg.elevenlabs.apiKey) return false;
    // Any language resolution path must yield an id for at least one supported lang
    return voice.languages.some((lang) => Boolean(resolveProviderVoiceId(voice, lang)));
  }

  if (voice.provider === 'openai' || cfg.providerId === 'openai') {
    if (!cfg.openai.apiKey) return false;
    return voice.languages.some((lang) => Boolean(resolveProviderVoiceId(voice, lang)));
  }

  return false;
}

/**
 * @param {AtlasVoice} voice
 * @param {string} language
 */
export function voiceSupportsLanguage(voice, language) {
  if (!voice) return false;
  return voice.languages.includes(String(language || '').trim());
}

/**
 * Absolute path to Lara master asset if present.
 */
export function getLaraMasterPath() {
  const p = join(VOICE_SOURCE_DIR, 'lara-master.mp3');
  return existsSync(p) ? p : null;
}

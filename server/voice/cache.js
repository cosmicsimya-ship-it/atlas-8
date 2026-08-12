/**
 * Synthesis audio cache — keyed by hash(text+voice+language+provider+model+settingsVersion).
 * Private user text is stored under data/voice-cache (gitignored), never under public/.
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { SYNTHESIS_SETTINGS_VERSION, VOICE_CACHE_DIR, getVoiceConfig } from './config.js';

/**
 * @param {{
 *   text: string,
 *   voice: string,
 *   language: string,
 *   provider: string,
 *   model: string,
 *   format?: string,
 *   speed?: number|null,
 *   settingsVersion?: string,
 * }} parts
 */
export function buildCacheKey(parts) {
  const payload = [
    String(parts.text || ''),
    String(parts.voice || ''),
    String(parts.language || ''),
    String(parts.provider || ''),
    String(parts.model || ''),
    String(parts.format || 'mp3'),
    parts.speed == null ? '' : String(parts.speed),
    String(parts.settingsVersion || SYNTHESIS_SETTINGS_VERSION),
  ].join('\u0001');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

function ensureCacheDir() {
  if (!existsSync(VOICE_CACHE_DIR)) {
    mkdirSync(VOICE_CACHE_DIR, { recursive: true });
  }
}

/**
 * @param {string} key
 */
function pathsForKey(key) {
  const safe = String(key).replace(/[^a-f0-9]/gi, '').slice(0, 64);
  return {
    audio: join(VOICE_CACHE_DIR, `${safe}.bin`),
    meta: join(VOICE_CACHE_DIR, `${safe}.json`),
  };
}

/**
 * @param {string} key
 * @returns {{ hit: boolean, audioBuffer?: Buffer, mimeType?: string, format?: string, meta?: object }}
 */
export function readCache(key) {
  const cfg = getVoiceConfig();
  if (!cfg.cacheEnabled) return { hit: false };

  try {
    ensureCacheDir();
    const { audio, meta } = pathsForKey(key);
    if (!existsSync(audio) || !existsSync(meta)) return { hit: false };

    const metaObj = JSON.parse(readFileSync(meta, 'utf8'));
    const age = Date.now() - Number(metaObj.cachedAt || 0);
    if (age > cfg.cacheTtlMs) {
      try {
        unlinkSync(audio);
        unlinkSync(meta);
      } catch {
        /* ignore */
      }
      return { hit: false };
    }

    return {
      hit: true,
      audioBuffer: readFileSync(audio),
      mimeType: metaObj.mimeType || 'audio/mpeg',
      format: metaObj.format || 'mp3',
      meta: metaObj,
    };
  } catch {
    return { hit: false };
  }
}

/**
 * @param {string} key
 * @param {{
 *   audioBuffer: Buffer,
 *   mimeType: string,
 *   format: string,
 *   provider: string,
 *   voice: string,
 *   language: string,
 *   model?: string,
 *   charCount?: number,
 * }} entry
 */
export function writeCache(key, entry) {
  const cfg = getVoiceConfig();
  if (!cfg.cacheEnabled) return false;
  if (!entry?.audioBuffer?.length) return false;

  try {
    ensureCacheDir();
    const { audio, meta } = pathsForKey(key);
    writeFileSync(audio, entry.audioBuffer);
    writeFileSync(
      meta,
      JSON.stringify({
        cachedAt: Date.now(),
        mimeType: entry.mimeType,
        format: entry.format,
        provider: entry.provider,
        voice: entry.voice,
        language: entry.language,
        model: entry.model || null,
        charCount: entry.charCount ?? null,
        settingsVersion: SYNTHESIS_SETTINGS_VERSION,
        // Never store full text
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort cache stats (no private content).
 */
export function getCacheStats() {
  try {
    ensureCacheDir();
    const files = readdirSync(VOICE_CACHE_DIR).filter((f) => f.endsWith('.bin'));
    let bytes = 0;
    for (const f of files) {
      try {
        bytes += statSync(join(VOICE_CACHE_DIR, f)).size;
      } catch {
        /* ignore */
      }
    }
    return { entries: files.length, bytes };
  } catch {
    return { entries: 0, bytes: 0 };
  }
}

/** Test helper */
export function clearVoiceCacheForTests() {
  try {
    if (!existsSync(VOICE_CACHE_DIR)) return;
    for (const f of readdirSync(VOICE_CACHE_DIR)) {
      try {
        unlinkSync(join(VOICE_CACHE_DIR, f));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

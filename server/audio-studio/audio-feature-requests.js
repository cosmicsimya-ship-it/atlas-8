/**
 * Minimal feature-request store for audio studio (and reusable shape).
 * Does NOT claim permanent product backlog without explicit user consent wording.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(__dirname, '..', '..', 'data', 'audio-studio-requests.json');

function ensureStore() {
  const dir = dirname(STORE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(STORE_PATH)) {
    writeFileSync(STORE_PATH, JSON.stringify({ version: 1, requests: [] }, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { version: 1, requests: [] };
  }
}

function writeStore(data) {
  ensureStore();
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * @param {{
 *   requestedBy?: string|null,
 *   userId?: string|null,
 *   request: string,
 *   detectedCapabilities?: string[],
 *   source?: string,
 *   persistConsent?: boolean,
 * }} input
 */
export function recordAudioFeatureRequest(input) {
  const store = readStore();
  const entry = {
    id: `afr_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`,
    category: 'audio_studio',
    requestedBy: input.requestedBy || null,
    userId: input.userId || null,
    request: String(input.request || '').slice(0, 4000),
    detectedCapabilities: input.detectedCapabilities || [],
    source: input.source || 'unknown',
    status: input.persistConsent ? 'proposed' : 'session_noted',
    persistConsent: Boolean(input.persistConsent),
    createdAt: new Date().toISOString(),
  };
  store.requests.push(entry);
  // Keep last 500
  if (store.requests.length > 500) {
    store.requests = store.requests.slice(-500);
  }
  writeStore(store);
  return entry;
}

export function listAudioFeatureRequests(limit = 50) {
  const store = readStore();
  return (store.requests || []).slice(-limit).reverse();
}

/** Test helper — wipe store file content */
export function _resetFeatureRequestStore() {
  ensureStore();
  writeStore({ version: 1, requests: [] });
}

// ═══════════════════════════════════════════════════════════════════════
// API Key Store
//
// WHY THIS EXISTS:
// API keys must never be in source code, .env files shipped to the
// browser, or hardcoded anywhere. The user enters their own keys in
// Settings → API Keys. Keys are stored in localStorage (encrypted in
// production via a future enhancement) and loaded into memory on boot.
//
// ARCHITECTURAL DECISION:
// Zustand with localStorage persistence. The ai-provider service
// reads keys from this store at call time. When a key exists, real
// API calls are made. When empty, mock fallbacks are used.
// This is the same pattern used by Cursor, Bolt, and v0.
// ═══════════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const STORAGE_KEY = 'atlas-api-keys';

export type ProviderKey = 'openai' | 'anthropic' | 'google';

export interface KeyEntry {
  key: string;
  status: 'untested' | 'valid' | 'invalid' | 'testing';
  lastTested: number | null;
}

interface APIKeyState {
  keys: Record<ProviderKey, KeyEntry>;
  setKey: (provider: ProviderKey, key: string) => void;
  clearKey: (provider: ProviderKey) => void;
  setStatus: (provider: ProviderKey, status: KeyEntry['status']) => void;
  getKey: (provider: ProviderKey) => string;
  isConfigured: (provider: ProviderKey) => boolean;
}

function loadFromStorage(): Record<ProviderKey, KeyEntry> {
  const defaults: Record<ProviderKey, KeyEntry> = {
    openai: { key: '', status: 'untested', lastTested: null },
    anthropic: { key: '', status: 'untested', lastTested: null },
    google: { key: '', status: 'untested', lastTested: null },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle new providers added in future
    return {
      openai: { ...defaults.openai, ...parsed.openai },
      anthropic: { ...defaults.anthropic, ...parsed.anthropic },
      google: { ...defaults.google, ...parsed.google },
    };
  } catch {
    return defaults;
  }
}

function saveToStorage(keys: Record<ProviderKey, KeyEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // localStorage full or blocked — keys remain in memory only
  }
}

export const useAPIKeyStore = create<APIKeyState>((set, get) => ({
  keys: loadFromStorage(),

  setKey: (provider, key) => {
    set((state) => {
      const updated = {
        ...state.keys,
        [provider]: { key, status: 'untested' as const, lastTested: null },
      };
      saveToStorage(updated);
      return { keys: updated };
    });
  },

  clearKey: (provider) => {
    set((state) => {
      const updated = {
        ...state.keys,
        [provider]: { key: '', status: 'untested' as const, lastTested: null },
      };
      saveToStorage(updated);
      return { keys: updated };
    });
  },

  setStatus: (provider, status) => {
    set((state) => {
      const updated = {
        ...state.keys,
        [provider]: { ...state.keys[provider], status, lastTested: Date.now() },
      };
      saveToStorage(updated);
      return { keys: updated };
    });
  },

  getKey: (provider) => get().keys[provider].key,

  isConfigured: (provider) => get().keys[provider].key.length > 0,
}));

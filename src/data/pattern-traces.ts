/**
 * A15 — Pattern Gap: lived "iz" pool for empty-state discoverability.
 * Human language only. No engine / product surface names.
 */

export type PatternTraceId =
  | 'tekrar'
  | 'tarih'
  | 'kisi'
  | 'ruya'
  | 'celiski'
  | 'sembol'
  | 'donem'
  | 'secim';

export type PatternTrace = {
  id: PatternTraceId;
  /** Visible human label */
  label: string;
  /** Marker token carried into composer context (not a full sentence) */
  marker: string;
};

/** Controlled pool — never show engine names. */
export const PATTERN_TRACE_POOL: readonly PatternTrace[] = [
  { id: 'tekrar', label: 'tekrar', marker: 'tekrar' },
  { id: 'tarih', label: 'tarih', marker: 'tarih' },
  { id: 'kisi', label: 'kişi', marker: 'kişi' },
  { id: 'ruya', label: 'rüya', marker: 'rüya' },
  { id: 'celiski', label: 'çelişki', marker: 'çelişki' },
  { id: 'sembol', label: 'sembol', marker: 'sembol' },
  { id: 'donem', label: 'dönem', marker: 'dönem' },
  { id: 'secim', label: 'seçim', marker: 'seçim' },
] as const;

export const PATTERN_GAP_VISIBLE_COUNT = 3;

export const SESSION_TRACES_KEY = 'atlas.pattern_gap.visible_traces.v1';

/** Soft multi-select prompts — question form, no auto-link claim. */
export const CONVERGENCE_HINTS = [
  'Bunları birlikte ele al.',
  'Bunlar aynı yere mi bakıyor?',
] as const;

/**
 * Placeholder candidates scored 1–5 on:
 * intelligence, simplicity, room for user, Atlas tone, first-message lift.
 * Winner: "Ne taşıyorsun?" (23/25).
 */
export const PLACEHOLDER_CANDIDATES = [
  {
    text: 'Ne taşıyorsun?',
    scores: { intelligence: 4, simplicity: 5, room: 5, atlas: 5, lift: 4 },
  },
  {
    text: 'İlk satır yeter.',
    scores: { intelligence: 4, simplicity: 5, room: 5, atlas: 4, lift: 5 },
  },
  {
    text: 'Ne geliyor?',
    scores: { intelligence: 4, simplicity: 5, room: 5, atlas: 4, lift: 4 },
  },
  {
    text: 'Bir şey getir.',
    scores: { intelligence: 3, simplicity: 5, room: 5, atlas: 4, lift: 4 },
  },
  {
    text: 'Şimdi ne var?',
    scores: { intelligence: 3, simplicity: 5, room: 5, atlas: 3, lift: 5 },
  },
  {
    text: 'Buraya bırak.',
    scores: { intelligence: 3, simplicity: 5, room: 5, atlas: 4, lift: 4 },
  },
  {
    text: 'Nerede takılıyorsun?',
    scores: { intelligence: 4, simplicity: 4, room: 3, atlas: 4, lift: 4 },
  },
  {
    text: 'Bir iz yeter.',
    scores: { intelligence: 3, simplicity: 4, room: 4, atlas: 4, lift: 4 },
  },
  {
    text: 'Kendi dilinle.',
    scores: { intelligence: 3, simplicity: 4, room: 5, atlas: 3, lift: 3 },
  },
  {
    text: 'Anlatmaya başla.',
    scores: { intelligence: 2, simplicity: 4, room: 4, atlas: 2, lift: 4 },
  },
  {
    text: 'Ne bakıyoruz burada?',
    scores: { intelligence: 3, simplicity: 3, room: 4, atlas: 4, lift: 3 },
  },
  {
    text: 'Bir işaret getir. Gerisini birlikte okuruz.',
    scores: { intelligence: 3, simplicity: 2, room: 2, atlas: 3, lift: 3 },
  },
] as const;

export function scorePlaceholder(scores: {
  intelligence: number;
  simplicity: number;
  room: number;
  atlas: number;
  lift: number;
}): number {
  return (
    scores.intelligence +
    scores.simplicity +
    scores.room +
    scores.atlas +
    scores.lift
  );
}

/** Default empty-state composer placeholder (visible layer). */
export const PATTERN_GAP_PLACEHOLDER = 'Aklındakini anlat…';

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic shuffle — stable for a given seed. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  let state = hashSeed(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function readSessionStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode / quota — fall through in-memory only */
  }
}

function resolveSessionSeed(): string {
  const existing = readSessionStorage('atlas.pattern_gap.session_seed.v1');
  if (existing) return existing;
  const seed =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeSessionStorage('atlas.pattern_gap.session_seed.v1', seed);
  return seed;
}

/** Session-stable visible traces (max 3). New browser session → controlled variation. */
export function getSessionVisibleTraces(
  count: number = PATTERN_GAP_VISIBLE_COUNT,
): PatternTrace[] {
  const cached = readSessionStorage(SESSION_TRACES_KEY);
  if (cached) {
    try {
      const ids = JSON.parse(cached) as PatternTraceId[];
      if (Array.isArray(ids) && ids.length === count) {
        const mapped = ids
          .map((id) => PATTERN_TRACE_POOL.find((t) => t.id === id))
          .filter((t): t is PatternTrace => Boolean(t));
        if (mapped.length === count) return mapped;
      }
    } catch {
      /* recompute */
    }
  }

  const seed = resolveSessionSeed();
  const picked = seededShuffle(PATTERN_TRACE_POOL, seed).slice(0, count);
  writeSessionStorage(SESSION_TRACES_KEY, JSON.stringify(picked.map((t) => t.id)));
  return picked;
}

export function getSessionConvergenceHint(): string {
  const seed = resolveSessionSeed();
  return CONVERGENCE_HINTS[hashSeed(seed) % CONVERGENCE_HINTS.length];
}

/** Format selected markers for send payload — not a full sentence. */
export function formatTraceMarkers(traces: PatternTrace[]): string {
  if (!traces.length) return '';
  return traces.map((t) => `[${t.marker}]`).join(' ');
}

export function composeMessageWithTraces(
  userText: string,
  traces: PatternTrace[],
): string {
  const body = userText.trim();
  const markers = formatTraceMarkers(traces);
  if (!markers) return body;
  if (!body) return markers;
  return `${markers}\n${body}`;
}

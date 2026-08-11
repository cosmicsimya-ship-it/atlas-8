/**
 * Empty-state discovery questions — natural language only.
 * Internal intents (if present) are never shown or serialized into the composer.
 */

export type DiscoveryQuestionId =
  | 'date'
  | 'pattern'
  | 'repeat'
  | 'person'
  | 'contradiction';

export type DiscoveryQuestion = {
  id: DiscoveryQuestionId;
  /** User-visible question — fills composer as-is */
  text: string;
  /**
   * Optional routing hint. Never rendered, never written into messages.
   * @internal
   */
  intent?: string;
};

/**
 * Fixed empty-state set — no session rotation on this surface.
 * Distinct meaning fields; no repeated verb/pattern.
 */
export const DISCOVERY_QUESTION_POOL: readonly DiscoveryQuestion[] = [
  {
    id: 'date',
    text: 'Bu tarih neden karşıma çıkıyor?',
    intent: 'tarih',
  },
  {
    id: 'pattern',
    text: 'Asıl örüntü ne?',
    intent: 'oruntu',
  },
  {
    id: 'repeat',
    text: 'Bu tesadüf mü, yoksa bir tekrar mı?',
    intent: 'tekrar',
  },
  {
    id: 'person',
    text: 'Bu kişi neden yeniden gündeme geldi?',
    intent: 'kisi',
  },
  {
    id: 'contradiction',
    text: 'Söylediğiyle yaptığı neden çelişiyor?',
    intent: 'celiski',
  },
] as const;

/** Fixed composition order for the empty-state surface. */
export const EMPTY_STATE_DISCOVERY_QUESTIONS: readonly DiscoveryQuestion[] =
  DISCOVERY_QUESTION_POOL;

export const DISCOVERY_VISIBLE_COUNT = EMPTY_STATE_DISCOVERY_QUESTIONS.length;

/** @deprecated Use DISCOVERY_VISIBLE_COUNT */
export const PATTERN_GAP_VISIBLE_COUNT = DISCOVERY_VISIBLE_COUNT;

/** Default empty-state composer placeholder (visible layer). */
export const PATTERN_GAP_PLACEHOLDER = 'Aklındakini anlat…';

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

/** Deterministic shuffle — kept for non-empty-state utilities/tests. */
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

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Empty-state discovery questions — fixed set, no session rotation.
 */
export function getEmptyStateDiscoveryQuestions(): DiscoveryQuestion[] {
  return [...EMPTY_STATE_DISCOVERY_QUESTIONS];
}

/**
 * @deprecated Use getEmptyStateDiscoveryQuestions — rotation is off on this surface.
 */
export function getSessionVisibleDiscoveryQuestions(): DiscoveryQuestion[] {
  return getEmptyStateDiscoveryQuestions();
}

/** Public text only — never includes intent / markers. */
export function discoveryQuestionToComposerText(question: DiscoveryQuestion): string {
  return question.text.trim();
}

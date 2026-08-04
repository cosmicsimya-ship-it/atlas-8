/**
 * Persona Feedback — shared constants & feature flag (Phase 2).
 */

export const PERSONA_FEEDBACK_VERSION = 'feedback-v1';

export const FEEDBACK_CATEGORIES = [
  'tone',
  'length',
  'formality',
  'word_choice',
  'sentence_structure',
  'formatting',
  'brand_voice',
  'channel_voice',
  'content_depth',
  'repetition',
  'banned_expression',
  'preferred_expression',
  'editing_pattern',
  'reasoning_presentation',
  'symbolic_language',
  'factuality_boundary',
];

export const SCOPE_TYPES = [
  'global',
  'brand',
  'voice',
  'channel',
  'content_type',
  'task_type',
  'single_response',
  'temporary_session',
];

export const POLARITIES = ['prefer', 'avoid', 'ban', 'continue'];

export const PERSISTENCE_LEVELS = ['ignore', 'session', 'candidate', 'persistent'];

export const RECORD_STATUSES = ['active', 'superseded', 'archived'];

/** Priority: higher wins when resolving conflicts (spec §8). */
export const SCOPE_PRIORITY = {
  single_response: 100,
  temporary_session: 90,
  channel: 70,
  voice: 65,
  brand: 60,
  content_type: 50,
  task_type: 45,
  global: 20,
};

/**
 * Learning writes enabled when env is not explicitly false/0/off.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isPersonaFeedbackLearningEnabled(env = process.env) {
  const raw = String(env.PERSONA_FEEDBACK_LEARNING_ENABLED ?? 'true')
    .trim()
    .toLowerCase();
  return !(raw === 'false' || raw === '0' || raw === 'off' || raw === 'no');
}

export const BRAND_ALIASES = {
  'cosmic simya': 'cosmic-simya',
  'cosmic-simya': 'cosmic-simya',
  cosmicsimya: 'cosmic-simya',
  'astrolojik akıl': 'astrolojik-akil',
  'astrolojik akil': 'astrolojik-akil',
  'astrolojik-akil': 'astrolojik-akil',
  atlas: 'atlas-analysis',
};

export const CHANNEL_ALIASES = {
  telegram: 'telegram',
  tg: 'telegram',
  instagram: 'instagram',
  ig: 'instagram',
  threads: 'threads',
  pdf: 'pdf-report',
  'pdf rapor': 'pdf-report',
  'pdf raporu': 'pdf-report',
  blog: 'blog',
};

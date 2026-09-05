/**
 * Topic-based Qur'an verse retrieval — curated, deterministic index.
 *
 * This is NOT a search engine and does not invent references at request
 * time. It is a small, hand-curated map from a recognized topic to a fixed
 * list of well-established surah:ayah references. Every reference still
 * goes through the exact same structural + verified-text retrieval as an
 * explicit user-typed reference before it is ever shown — this index only
 * decides WHICH references to attempt, never what to say about them.
 *
 * Detection is intentionally independent of intent.js's QURAN_DOMAIN/
 * hasSureAyetWord checks: those require a properly-suffixed singular
 * "ayet"/"âyet" form and miss plural forms ("ayetler", "ayetleri") that
 * topic-style questions commonly use ("... ile ilgili ayetler",
 * "... hakkında ayetleri sırala"). Reusing them here would silently miss
 * exactly the phrasing this feature exists to handle.
 */

/** @typedef {'sabir'|'seytan_dusmanligi'|'umut'|'korku'|'merhamet'} QuranTopicKey */

/** Curated, ranked (most-established first) reference lists. Kept small and
 * conservative — only well-known, unambiguous references. */
export const TOPIC_VERSE_INDEX = Object.freeze({
  sabir: Object.freeze(['2:153', '3:200']),
  seytan_dusmanligi: Object.freeze(['35:6', '36:60']),
  umut: Object.freeze(['39:53']),
  korku: Object.freeze(['3:175']),
  merhamet: Object.freeze(['7:156', '21:107']),
});

/** Turkish display label per topic, for the reply header. */
export const TOPIC_DISPLAY_LABEL = Object.freeze({
  sabir: 'Sabır',
  seytan_dusmanligi: 'Şeytanın düşmanlığı',
  umut: 'Umut',
  korku: 'Korku',
  merhamet: 'Merhamet',
});

/** Evidence that this is a Qur'an-oriented question at all — deliberately
 * broader than intent.js's QURAN_DOMAIN (covers plural "ayetler"/"ayetleri"
 * and any "kur'an..." inflection). */
const TOPIC_QUERY_EVIDENCE_RE = /ayet\w*|kur['’]?an\w*/iu;

/** The question must be ASKING ABOUT a topic, not just mentioning one. */
const TOPIC_RELATION_CUE_RE = /hakk[ıi]nda|ilgili|konusunda|ne\s+diyor/iu;

/**
 * Topic keyword definitions. `requireAll` demands every pattern match
 * (used for "şeytanın düşmanlığı" so a message merely mentioning "şeytan"
 * elsewhere — e.g. a routing/history question — doesn't false-positive);
 * `requireAny` demands at least one.
 * @type {{ key: QuranTopicKey, requireAll?: RegExp[], requireAny?: RegExp[] }[]}
 */
const TOPIC_DEFINITIONS = [
  { key: 'seytan_dusmanligi', requireAll: [/[şs]eytan/iu, /d[uü][sş]man/iu] },
  { key: 'sabir', requireAny: [/sab[ıi]r/iu, /sabred/iu] },
  { key: 'umut', requireAny: [/\bumut/iu, /[uü]mit/iu] },
  { key: 'korku', requireAny: [/korku/iu] },
  { key: 'merhamet', requireAny: [/merhamet/iu, /rahmet/iu] },
];

/**
 * @param {string} message
 * @returns {{ active: boolean, topicKey: QuranTopicKey|null }}
 */
export function detectQuranTopicIntent(message) {
  const text = String(message ?? '').trim();
  if (!text) return { active: false, topicKey: null };
  if (!TOPIC_QUERY_EVIDENCE_RE.test(text)) return { active: false, topicKey: null };
  if (!TOPIC_RELATION_CUE_RE.test(text)) return { active: false, topicKey: null };

  for (const def of TOPIC_DEFINITIONS) {
    if (def.requireAll && def.requireAll.every((re) => re.test(text))) {
      return { active: true, topicKey: def.key };
    }
    if (def.requireAny && def.requireAny.some((re) => re.test(text))) {
      return { active: true, topicKey: def.key };
    }
  }

  // Shaped like a topic question ("... hakkında ayetler", Qur'an evidence
  // present) but matches no curated topic — recognized, unsupported. The
  // caller must fail closed rather than let this fall through to a path
  // that could invent a citation.
  return { active: true, topicKey: null };
}

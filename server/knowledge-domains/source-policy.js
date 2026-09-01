/**
 * Per-domain source policy — Atlas does not treat every knowledge domain's
 * sources equally. This is metadata only (no retrieval logic); it exists so
 * every domain handler, present or future, states its own trust model
 * instead of inheriting a default one.
 *
 * failClosed: true means "no verified/qualifying source found" must produce
 * a safe decline, never a confident guess — same posture as the Qur'an
 * citation-safety work this generalizes from. It is the default for every
 * domain in this file.
 */

/** @typedef {'quran'|'comparative_religion'|'mythology'|'esotericism'|'hermeticism_alchemy'|'numerology_symbolic'|'ancient_traditions'|'general_web'} KnowledgeDomainId */
/** @typedef {'primary_text'|'primary_source'|'scholarly_consensus'|'tradition_belief'|'historical_doctrine'|'later_interpretation'|'modern_claim'|'symbolic_interpretation'|'atlas_synthesis'|'web_source'|'speculative_hypothesis'|'disputed_uncertain'} FactLayerKey */

/**
 * The fact/interpretation layer taxonomy every domain reply should be able
 * to label its claims with (requirement C). Not every domain uses every
 * layer — see each policy's `factLayers`.
 */
export const FACT_LAYER_LABELS = Object.freeze({
  primary_text: 'Birincil metin (doğrulanmış)',
  primary_source: 'Birincil kaynak',
  scholarly_consensus: 'Tarihsel/bilimsel görüş birliği',
  tradition_belief: 'Geleneğe özgü inanç',
  historical_doctrine: 'Tarihsel doktrin',
  later_interpretation: 'Sonraki yorum/gelenek',
  modern_claim: 'Modern iddia',
  symbolic_interpretation: 'Sembolik yorum',
  atlas_synthesis: 'Atlas yorumu/sentezi',
  web_source: 'Web kaynağı (atıflı)',
  speculative_hypothesis: 'Spekülatif hipotez (doğrulanmamış)',
  disputed_uncertain: 'Tartışmalı / kaynaklar arasında görüş ayrılığı var',
});

/**
 * @type {Record<KnowledgeDomainId, {
 *   label: string,
 *   sourceType: string,
 *   failClosed: boolean,
 *   allowWebFallback: boolean,
 *   factLayers: (keyof typeof FACT_LAYER_LABELS)[],
 *   notes: string,
 * }>}
 */
export const SOURCE_POLICY = Object.freeze({
  quran: Object.freeze({
    label: 'Kur’an / İslami birincil kaynak',
    sourceType: 'deterministic_verified',
    failClosed: true,
    allowWebFallback: false,
    factLayers: Object.freeze(['primary_text']),
    notes:
      'Strictest policy in the system. Deterministic local structural check ' +
      '+ verified-text retrieval only; never LLM-authored. Never relaxed by ' +
      'this or any future domain — see citation-verify.js / semantic-verify.js.',
  }),
  comparative_religion: Object.freeze({
    label: 'Karşılaştırmalı din / dinler tarihi',
    sourceType: 'academic_reference',
    failClosed: true,
    allowWebFallback: true,
    factLayers: Object.freeze(['primary_source', 'scholarly_consensus', 'tradition_belief']),
    notes: 'Web-backed handler via createWebBackedDomainHandler() — see registry.js.',
  }),
  mythology: Object.freeze({
    label: 'Mitoloji',
    sourceType: 'classical_source_plus_scholarship',
    failClosed: true,
    allowWebFallback: true,
    factLayers: Object.freeze([
      'primary_source',
      'scholarly_consensus',
      'tradition_belief',
      'symbolic_interpretation',
    ]),
    notes: 'Web-backed handler via createWebBackedDomainHandler() — see registry.js.',
  }),
  esotericism: Object.freeze({
    label: 'Ezoterizm / okült gelenekler',
    sourceType: 'historical_doctrine_vs_modern_claim',
    failClosed: true,
    allowWebFallback: true,
    factLayers: Object.freeze(['historical_doctrine', 'later_interpretation', 'modern_claim']),
    notes:
      'Must separate historical doctrine from later interpretation from ' +
      'modern claim explicitly — this is the domain most prone to ' +
      'presenting speculation as established fact. Web-backed handler via ' +
      'createWebBackedDomainHandler() — see registry.js.',
  }),
  hermeticism_alchemy: Object.freeze({
    label: 'Hermetizm / simya',
    sourceType: 'classical_source_plus_scholarship',
    failClosed: true,
    allowWebFallback: true,
    factLayers: Object.freeze([
      'primary_source',
      'scholarly_consensus',
      'tradition_belief',
      'symbolic_interpretation',
    ]),
    notes: 'Web-backed handler via createWebBackedDomainHandler() — see registry.js.',
  }),
  numerology_symbolic: Object.freeze({
    label: 'Numeroloji ve tarihsel sembolik sistemler',
    sourceType: 'tradition_specific',
    failClosed: true,
    allowWebFallback: true,
    factLayers: Object.freeze([
      'tradition_belief',
      'scholarly_consensus',
      'symbolic_interpretation',
      'atlas_synthesis',
    ]),
    notes:
      'Distinct from Atlas\'s existing personal-numerology engine (birth-date ' +
      'readings, already interpretation-labeled) — this covers ASKING ABOUT ' +
      'historical numeric-symbolic systems as a topic. Detection is kept ' +
      'deliberately narrow to avoid colliding with personal numerology intent. ' +
      'allowWebFallback flipped to true in the web-retrieval expansion — ' +
      'Atlas\'s own numerology ENGINE (readings) is unaffected.',
  }),
  ancient_traditions: Object.freeze({
    label: 'Kadim gelenekler / tarihsel ruhsal sistemler',
    sourceType: 'academic_reference_plus_primary',
    failClosed: true,
    allowWebFallback: true,
    factLayers: Object.freeze(['primary_source', 'scholarly_consensus', 'tradition_belief']),
    notes: 'Web-backed handler via createWebBackedDomainHandler() — see registry.js.',
  }),
  general_web: Object.freeze({
    label: 'Genel / güncel bilgi',
    sourceType: 'web_retrieval',
    failClosed: true,
    allowWebFallback: true,
    factLayers: Object.freeze(['web_source']),
    notes:
      'Web-backed handler via createWebBackedDomainHandler() — see registry.js; ' +
      'has a recency/freshness cue (web-search-provider.js wantsFreshness()). ' +
      'Never mix an unattributed web claim into the same sentence as a ' +
      'primary-source claim from another domain.',
  }),
});

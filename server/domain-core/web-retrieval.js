const RETRIEVAL_LABELS = Object.freeze([
  'primary source',
  'scholarly consensus',
  'historical doctrine',
  'traditional belief',
  'later interpretation',
  'modern claim',
  'symbolic interpretation',
  'Atlas synthesis',
]);

export const ATLAS_WEB_RETRIEVAL_PROVIDER = 'openai-web-search';
export const ATLAS_WEB_RETRIEVAL_VERSION = '1.0.0';

const EXCLUDED_QURAN_RE = /\b(kur['’]?an|qur['’]?an|quran|ayet|âyet|sure|sûre|surah|ayah|diyanet|meal|tefsir)\b/i;
const CURRENT_RE = /\b(güncel|bugün|şu\s*an|son\s+durum|en\s+son|latest|current|today|recent|recently|this\s+(?:week|month|year)|202[5-9])\b/i;
const MODERN_PRACTICE_RE = /\b(günümüzde|modern\s+uygulama|modern\s+practice|topluluk|community|forum|reddit|çağdaş|contemporary)\b/i;

const DOMAIN_PATTERNS = [
  ['comparative-religion', /\b(karşılaştırmalı\s+din|comparative\s+religion|dinler\s+tarihi|budizm|buddhism|hinduizm|hinduism|zerdüşt|zoroastr|taoizm|taoism|şinto|shinto|mara)\b/i],
  ['mythology', /(mitoloji|mytholog|anka|phoenix|feniks|griffin|odin|zeus|isis|osiris|inanna|gilgamesh|quetzalcoatl)/i],
  ['hermeticism', /(hermetizm|hermeticism|hermetik|hermetic|corpus\s+hermeticum|kybalion|nous)/i],
  ['alchemy', /(simya|alchemy|alchemical|nigredo|albedo|rubedo|citrinitas|prima\s+materia|philosopher.?s\s+stone)/i],
  ['esotericism', /(ezoter|esoter|okült|occult|gnost|kabal|kabbal|theosoph)/i],
  ['symbolic-systems-history', /(numeroloji|numerology|gematria|ebced|abjad|sembolik\s+sistem|symbolic\s+system|sayı\s+mistisizmi|number\s+mysticism)/i],
  ['ancient-traditions', /\b(kadim|ancient\s+tradition|antik\s+gelenek|eski\s+mısır|ancient\s+egypt|mezopotam|mesopotam|sümer|sumer|kuzey\s+yıldızı|north\s+star|polaris)\b/i],
];

function normalizeHost(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isGeneralFactualQuestion(message) {
  const text = String(message || '').trim();
  if (!text || text.length < 8) return false;
  if (!/[?？]$/.test(text) && !/\b(nedir|kimdir|hangisi|ne\s+zaman|nerede|kaç|what|who|when|where|which|how\s+many)\b/i.test(text)) return false;
  return /\b(güncel|bugün|şu\s*an|en\s+son|latest|current|today|kimdir|nedir|nerede|ne\s+zaman|kaç|what|who|where|when|which)\b/i.test(text);
}

export function resolveWebRetrievalPlan(message, env = process.env) {
  const text = String(message || '').trim();
  const enabled = String(env.ATLAS_WEB_RETRIEVAL_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled || !text || EXCLUDED_QURAN_RE.test(text)) {
    return {
      active: false,
      reason: !enabled ? 'disabled' : EXCLUDED_QURAN_RE.test(text) ? 'quran_strict_path' : 'empty',
      domain: null,
      freshness: 'standard',
      modernPractice: false,
    };
  }

  let domain = null;
  for (const [name, re] of DOMAIN_PATTERNS) {
    if (re.test(text)) {
      domain = name;
      break;
    }
  }
  if (!domain && isGeneralFactualQuestion(text)) domain = 'general-web-knowledge';
  if (!domain) {
    return {
      active: false,
      reason: 'not_retrieval_domain',
      domain: null,
      freshness: 'standard',
      modernPractice: false,
    };
  }

  return {
    active: true,
    reason: 'eligible_domain',
    domain,
    freshness: CURRENT_RE.test(text) || domain === 'general-web-knowledge' ? 'current' : 'standard',
    modernPractice: MODERN_PRACTICE_RE.test(text),
  };
}

export function buildWebRetrievalDirective(plan) {
  if (!plan?.active) return '';
  const recency = plan.freshness === 'current'
    ? 'This question is freshness-sensitive. Prefer the newest reliable sources, verify dates, and state an as-of date when material.'
    : 'Prefer historically authoritative and scholarly sources; recency is secondary unless the source has been superseded.';

  return `\n## ATLAS CORE — VERIFIED WEB RETRIEVAL\nUse the hosted web search tool for factual claims in domain: ${plan.domain}.\n${recency}\nSource priority: (1) primary/official; (2) academic/peer-reviewed/scholarly; (3) museums, libraries, encyclopedic reference works; (4) reputable historical references. Blogs/forums/modern esoteric sites are lower-confidence interpretive evidence${plan.modernPractice ? ', but may be used when they directly document modern/community practice' : ''}.\nDo not fabricate a source, title, date, URL, quotation, or consensus. Synthesize across multiple independent high-quality sources when available.\nKeep each externally grounded claim epistemically classifiable using one of these exact labels where appropriate: ${RETRIEVAL_LABELS.join(', ')}. Atlas synthesis must be clearly separated from sourced doctrine/history.\nQur'an verse text/citations remain OUTSIDE this path and must use the deterministic Qur'an verifier only.`;
}

export function buildOpenAIWebSearchConfig(plan) {
  if (!plan?.active) return null;
  return {
    tools: [
      {
        type: 'web_search',
        search_context_size: plan.freshness === 'current' ? 'high' : 'medium',
      },
    ],
    include: ['web_search_call.action.sources'],
  };
}

function sourceTier(host, title = '', modernPractice = false) {
  const hay = `${host} ${title}`.toLowerCase();
  if (/\.(gov|gov\.tr)$|(^|\.)who\.int$|(^|\.)un\.org$/.test(host)) {
    return { score: 100, classLabel: 'primary source', quality: 'primary/official' };
  }
  if (/\.edu$|\.edu\.|\.ac\.|doi\.org$|jstor\.org$|pubmed\.ncbi\.nlm\.nih\.gov$|cambridge\.org$|oup\.com$|oxfordreference\.com$|brill\.com$|springer\.com$|nature\.com$|sciencedirect\.com$/.test(host)) {
    return { score: 92, classLabel: 'scholarly consensus', quality: 'scholarly' };
  }
  if (/britishmuseum\.org$|metmuseum\.org$|si\.edu$|loc\.gov$|bl\.uk$|bnf\.fr$|getty\.edu$|worldcat\.org$|britannica\.com$|encyclopedia\.com$/.test(host)) {
    return { score: 86, classLabel: 'historical doctrine', quality: 'museum/library/reference' };
  }
  if (/archive\.org$|sacred-texts\.com$|perseus\.tufts\.edu$/.test(host)) {
    return { score: 78, classLabel: 'historical doctrine', quality: 'historical/reference' };
  }
  if (/reddit\.com$|quora\.com$|medium\.com$|substack\.com$|wordpress\.com$|blogspot\./.test(host) || /blog|forum|occult|esoteric/.test(hay)) {
    return {
      score: modernPractice ? 55 : 25,
      classLabel: modernPractice ? 'modern claim' : 'later interpretation',
      quality: 'lower-confidence interpretive',
    };
  }
  return { score: 65, classLabel: 'modern claim', quality: 'general reputable/unknown' };
}

export function extractRankedWebSources(data, plan = {}) {
  const seen = new Map();
  for (const block of data?.output || []) {
    if (block?.type === 'web_search_call') {
      for (const source of block?.action?.sources || []) {
        const url = String(source?.url || '').trim();
        if (!url) continue;
        const title = String(source?.title || source?.name || url).trim();
        if (!seen.has(url)) seen.set(url, { url, title });
      }
    }
    if (block?.type === 'message') {
      for (const part of block?.content || []) {
        for (const ann of part?.annotations || []) {
          const url = String(ann?.url || ann?.url_citation?.url || '').trim();
          if (!url) continue;
          const title = String(ann?.title || ann?.url_citation?.title || url).trim();
          if (!seen.has(url)) seen.set(url, { url, title });
        }
      }
    }
  }

  return [...seen.values()]
    .map((source) => {
      const host = normalizeHost(source.url);
      const tier = sourceTier(host, source.title, Boolean(plan.modernPractice));
      return { ...source, host, ...tier };
    })
    .sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
}

export function appendWebSourceAttribution(content, sources) {
  const text = String(content || '').trim();
  if (!text || !Array.isArray(sources) || sources.length === 0) return text;
  const lines = sources
    .slice(0, 8)
    .map((source, index) => `${index + 1}. [${source.classLabel}] ${source.title} — ${source.url}`);
  return `${text}\n\nKaynaklar (Atlas Core; kalite sırasıyla):\n${lines.join('\n')}`;
}

export function buildRetrievalUnavailableReply(plan) {
  if (plan?.freshness === 'current') {
    return 'Güncel dış kaynak doğrulamasına şu anda erişemiyorum; bu nedenle güncel bir iddiayı doğrulanmış gibi sunmayacağım.';
  }
  return 'Dış kaynak doğrulamasına şu anda erişemiyorum. Güvenilir bir yerel doğrulanmış kaynak olmadığı için kaynak veya olgu uydurmayacağım.';
}

export function getRetrievalLabels() {
  return [...RETRIEVAL_LABELS];
}

/**
 * Channel-independent retrieval provider contract used by Atlas Core.
 * The provider does not know whether the request came from web, Telegram,
 * or another adapter; it only receives the normalized user message.
 */
export function createAtlasWebRetrievalProvider() {
  return Object.freeze({
    providerId: ATLAS_WEB_RETRIEVAL_PROVIDER,
    version: ATLAS_WEB_RETRIEVAL_VERSION,
    plan: resolveWebRetrievalPlan,
    buildDirective: buildWebRetrievalDirective,
    buildRequestConfig: buildOpenAIWebSearchConfig,
    extractSources: extractRankedWebSources,
    attribute: appendWebSourceAttribution,
    unavailableReply: buildRetrievalUnavailableReply,
  });
}

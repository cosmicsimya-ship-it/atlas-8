/**
 * Real external web retrieval — Atlas Core, channel-independent.
 *
 * Provider choice: OpenAI's Responses API hosted `web_search` tool, via the
 * SAME OPENAI_API_KEY already used for every other model call in this
 * codebase (server/openai-client.js talks to the same /v1/responses
 * endpoint). No new paid dependency, no new credential to manage.
 *
 * Deliberately isolated from openai-client.js's callOpenAI(): this makes
 * its own request with its own tool configuration, so adding web search
 * can never affect the core conversational pipeline, its retry budget, or
 * its cost accounting.
 *
 * Fails closed by construction (requirement 6): a missing key, network
 * error, timeout, malformed response, or — critically — a response that
 * comes back with NO attributable URL citation is all treated identically
 * as "web retrieval unavailable". This function never returns `ok: true`
 * with a fabricated or unsourced claim.
 */

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const WEB_SEARCH_TOOL_TYPE = 'web_search';
const DEFAULT_WEB_SEARCH_MODEL =
  process.env.OPENAI_WEB_SEARCH_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const DEFAULT_TIMEOUT_MS = 20_000;

/** @typedef {'high'|'medium'|'low'} SourceQualityTier */
/** @typedef {{ url: string, title: string|null, qualityTier: SourceQualityTier }} WebSource */

// ── Source-quality ranking (requirement 3) ──────────────────────────────
// Deterministic, domain-name based. Not exhaustive — a reasonable, honest
// starting set. Unknown domains default to 'medium' (neutral: neither
// elevated nor dismissed) rather than guessed in either direction.

const HIGH_QUALITY_DOMAINS = Object.freeze([
  'britannica.com', 'jstor.org', 'archive.org', 'loc.gov', 'metmuseum.org',
  'plato.stanford.edu', 'iep.utm.edu', 'perseus.tufts.edu', 'sacred-texts.com',
  'oxfordreference.com', 'worldcat.org', 'nationalgeographic.com', 'si.edu',
  'britishmuseum.org', 'louvre.fr', 'bl.uk', 'unesco.org', 'penn.museum',
]);

/** Primary-text archives specifically — a step above general "scholarly". */
const PRIMARY_TEXT_ARCHIVE_DOMAINS = Object.freeze(['sacred-texts.com', 'perseus.tufts.edu', 'archive.org']);

const LOW_QUALITY_DOMAINS = Object.freeze([
  'reddit.com', 'quora.com', 'medium.com', 'pinterest.com', 'facebook.com',
  'tumblr.com', 'instagram.com', 'blogspot.com', 'wordpress.com', 'tiktok.com',
  'x.com', 'twitter.com',
]);

const REFERENCE_TIER_DOMAINS = Object.freeze(['wikipedia.org']);

/** @param {string} url */
function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/** @param {string} hostname @param {readonly string[]} list */
function domainMatches(hostname, list) {
  return list.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

/** @param {string} url @returns {SourceQualityTier} */
export function rankSourceQuality(url) {
  const host = hostnameOf(url);
  if (!host) return 'low';
  if (/\.(edu|gov)$/.test(host) || /\.ac\.[a-z]{2}$/.test(host)) return 'high';
  if (domainMatches(host, HIGH_QUALITY_DOMAINS)) return 'high';
  if (domainMatches(host, LOW_QUALITY_DOMAINS)) return 'low';
  if (domainMatches(host, REFERENCE_TIER_DOMAINS)) return 'medium';
  return 'medium';
}

/**
 * Maps a ranked source to the fact/interpretation layer taxonomy
 * (requirement 4) — a structural default, not a semantic read of the
 * source's actual content.
 * @param {WebSource} source
 * @returns {import('./source-policy.js').FactLayerKey}
 */
export function suggestFactLayer(source) {
  const host = hostnameOf(source.url) ?? '';
  if (source.qualityTier === 'high') {
    return domainMatches(host, PRIMARY_TEXT_ARCHIVE_DOMAINS) ? 'primary_source' : 'scholarly_consensus';
  }
  if (source.qualityTier === 'low') return 'modern_claim';
  return 'later_interpretation';
}

const FRESHNESS_CUE_RE = /g[uü]ncel|en\s+son|bug[uü]n|şu\s+an|son\s+geli[şs]meler|current|latest/iu;

/** @param {string} message */
export function wantsFreshness(message) {
  return FRESHNESS_CUE_RE.test(String(message ?? ''));
}

/**
 * Extract answer text + URL citations from a Responses API payload that
 * used the web_search tool. Robust to missing/renamed fields — anything
 * unexpected is simply omitted, never guessed. Sources are deduplicated by
 * URL and sorted best-quality-first (requirement: source ranking).
 * @param {any} data
 * @returns {{ text: string, sources: WebSource[] }}
 */
export function extractWebSearchOutput(data) {
  let text = '';
  /** @type {Map<string, WebSource>} */
  const sourceMap = new Map();

  for (const block of data?.output ?? []) {
    if (block?.type !== 'message' || !Array.isArray(block.content)) continue;
    for (const part of block.content) {
      if (part?.type !== 'output_text') continue;
      if (typeof part.text === 'string') text += part.text;
      for (const annotation of part.annotations ?? []) {
        if (annotation?.type !== 'url_citation' || typeof annotation.url !== 'string') continue;
        if (sourceMap.has(annotation.url)) continue;
        sourceMap.set(annotation.url, {
          url: annotation.url,
          title: typeof annotation.title === 'string' ? annotation.title : null,
          qualityTier: rankSourceQuality(annotation.url),
        });
      }
    }
  }

  const tierRank = { high: 0, medium: 1, low: 2 };
  const sources = [...sourceMap.values()].sort((a, b) => tierRank[a.qualityTier] - tierRank[b.qualityTier]);

  return { text: text.trim(), sources };
}

/**
 * @param {{
 *   query: string,
 *   domainInstructions?: string,
 *   apiKey?: string,
 *   model?: string,
 *   maxTokens?: number,
 *   timeoutMs?: number,
 *   fetchImpl?: typeof fetch,
 * }} opts
 * @returns {Promise<{ ok: boolean, answer: string|null, sources: WebSource[], error: string|null }>}
 */
export async function retrieveFromWeb(opts) {
  const apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY ?? '';
  const query = String(opts?.query ?? '').trim();
  if (!apiKey || !query) {
    return { ok: false, answer: null, sources: [], error: 'not_configured' };
  }

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { ok: false, answer: null, sources: [], error: 'not_configured' };
  }

  const freshnessHint = wantsFreshness(query)
    ? ' Kullanıcı güncel/en son bilgi istiyor; sonuçları buna göre değerlendir ve mümkünse tarih belirt.'
    : '';
  const domainHint = opts.domainInstructions ? ` ${opts.domainInstructions}` : '';

  let response;
  try {
    response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: opts.model || DEFAULT_WEB_SEARCH_MODEL,
        instructions:
          'Kısa, doğru bir yanıt ver. Yalnızca web aramasından gelen sonuçlara dayan; ' +
          'kendi hafızandan tarih, isim veya rakam uydurma.' +
          domainHint +
          freshnessHint,
        input: query,
        tools: [{ type: WEB_SEARCH_TOOL_TYPE }],
        max_output_tokens: opts.maxTokens ?? 500,
      }),
      signal: AbortSignal.timeout(Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, answer: null, sources: [], error: 'network_error' };
  }

  if (!response.ok) {
    return { ok: false, answer: null, sources: [], error: `http_${response.status}` };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { ok: false, answer: null, sources: [], error: 'malformed_response' };
  }

  const { text, sources } = extractWebSearchOutput(data);
  if (!text || !sources.length) {
    // No attributable source — never present an unattributed web claim.
    return { ok: false, answer: null, sources: [], error: 'no_attributable_source' };
  }

  return { ok: true, answer: text, sources, error: null };
}

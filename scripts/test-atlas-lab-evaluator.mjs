/**
 * ATLAS LAB evaluator — contract validation, prompt boundary, and one real
 * low-cost live call (gpt-4.1-mini, maxTokens 500) to prove the adapter
 * actually works end-to-end rather than only structurally.
 * Run: node scripts/test-atlas-lab-evaluator.mjs
 */
import {
  EVALUATOR_CATEGORIES,
  EVALUATOR_VERDICTS,
  buildEvaluationPrompt,
  validateEvaluationOutput,
  evaluateAtlasLabTrace,
} from '../server/atlas-lab/evaluator.js';

let passed = 0;
let failed = 0;
const failures = [];

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── Prompt boundary: only known-safe fields, no chain-of-thought field ──
{
  const trace = {
    requestId: 'req_x',
    channel: 'web',
    intent: 'test',
    engine: 'unit',
    userMessageSummary: '27.01.1986 numeroloji analizi yap',
    responseSummary: 'Test response text',
    reasoning: 'SECRET INTERNAL CHAIN OF THOUGHT — should never appear',
    apiKey: 'sk-should-never-appear',
  };
  const prompt = buildEvaluationPrompt(trace);
  record('prompt includes bounded userMessageSummary', prompt.includes('27.01.1986'));
  record('prompt does NOT include arbitrary/unlisted fields (reasoning)', !prompt.includes('SECRET INTERNAL CHAIN OF THOUGHT'));
  record('prompt does NOT include arbitrary/unlisted fields (apiKey)', !prompt.includes('sk-should-never-appear'));
}

// ── validateEvaluationOutput: contract clamping ──────────────────────────
{
  const good = validateEvaluationOutput({
    verdict: 'WARN',
    categories: ['routing_misfire', 'not_a_real_category'],
    explanation: 'x'.repeat(2000),
    expectedBehavior: 'should have routed to numerology engine',
    confidence: 'medium',
  });
  record('valid-shaped output accepted', good.ok === true);
  record('unknown category filtered out', good.ok && good.verdict.categories.length === 1 && good.verdict.categories[0] === 'routing_misfire');
  record('explanation truncated to bound', good.ok && good.verdict.explanation.length <= 1001);

  const badVerdict = validateEvaluationOutput({ verdict: 'MAYBE', categories: [], explanation: '', expectedBehavior: '', confidence: 'high' });
  record('invalid verdict rejected', badVerdict.ok === false);

  const notObject = validateEvaluationOutput('not an object');
  record('non-object input rejected', notObject.ok === false);

  const missingConfidence = validateEvaluationOutput({ verdict: 'PASS', categories: [], explanation: 'ok', expectedBehavior: '' });
  record('missing confidence defaults to low rather than throwing', missingConfidence.ok === true && missingConfidence.verdict.confidence === 'low');
}

// ── evaluateAtlasLabTrace: input guards ──────────────────────────────────
{
  const noTrace = await evaluateAtlasLabTrace(null);
  record('evaluateAtlasLabTrace(null) fails cleanly, does not throw', noTrace.ok === false);
}

// ── evaluateAtlasLabTrace: blocked when no API key ───────────────────────
{
  const savedKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const result = await evaluateAtlasLabTrace({ requestId: 'req_y', channel: 'web' });
  record('evaluateAtlasLabTrace reports blocked when OPENAI_API_KEY missing', result.ok === false && result.blocked === true);
  if (savedKey) process.env.OPENAI_API_KEY = savedKey;
}

// ── Real, low-cost live call (only if a key is actually configured) ─────
if (process.env.OPENAI_API_KEY) {
  const trace = {
    requestId: 'req_live_eval_test',
    channel: 'web',
    intent: 'numerology:full_analysis',
    engine: 'numerology-engine',
    selectedDomain: 'numerology-engine',
    selectedTools: [],
    routingDecision: 'numerology:full_analysis',
    retrievalSources: [],
    modelUsed: null,
    requestedModel: null,
    fallbackPath: null,
    postProcessors: [],
    errorState: null,
    contextMessageCount: 0,
    userMessageSummary: '27.01.1986 numeroloji analizi yap',
    responseSummary: 'Doğum tarihine göre yaşam yolu numarası ve kısa numeroloji özeti verildi.',
    totalDurationMs: 180,
    llmCallCount: 0,
    usedRetryOrFallback: false,
  };
  const result = await evaluateAtlasLabTrace(trace, { requestedBy: 'test-suite' });
  record('LIVE evaluator call succeeded', result.ok === true, result.ok ? '' : result.error);
  if (result.ok) {
    record('LIVE verdict is a valid enum value', EVALUATOR_VERDICTS.includes(result.verdict.verdict), result.verdict.verdict);
    record('LIVE categories are all known categories', result.verdict.categories.every((c) => EVALUATOR_CATEGORIES.includes(c)));
    record('LIVE explanation is non-empty', typeof result.verdict.explanation === 'string');
    record('LIVE call reports a model and latency', Boolean(result.model) && Number.isFinite(result.latencyMs));
    console.log(`  -> verdict=${result.verdict.verdict} categories=[${result.verdict.categories.join(',')}] confidence=${result.verdict.confidence} model=${result.model} latencyMs=${result.latencyMs}`);
  }
} else {
  console.log('(skipping live evaluator call — OPENAI_API_KEY not set in this environment)');
}

console.log('');
console.log(`ATLAS LAB evaluator tests: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error('Failures:', failures.join('; '));
  process.exit(1);
}

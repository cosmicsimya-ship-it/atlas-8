/**
 * Domain Core FAZ 2 scaffolding tests.
 * Run: node scripts/test-domain-core.mjs
 */
import {
  isDomainCoreEnabled,
  isDomainCoreDualRunEnabled,
  listEngines,
  getEngine,
  listMethodologies,
  resolveMethodology,
  getSource,
  resolveSources,
  resolveDepthFromMessage,
  resolveDepthLevel,
  validateStructuredAnalysisOutput,
  createEmptyStructuredOutput,
  STRUCTURED_ANALYSIS_SCHEMA_VERSION,
  dualRunNumerologyCalculations,
  runNumerologyAdapter,
  NUMEROLOGY_ADAPTER_VERSION,
} from '../server/domain-core/index.js';
import {
  ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY,
  computeBirthNumerologyChart,
} from '../server/numerology-engine/index.js';

let passed = 0;
let failed = 0;
/** @type {string[]} */
const failures = [];

function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(name);
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n=== Domain Core flags ===\n');
{
  const prev = process.env.ATLAS_DOMAIN_CORE;
  delete process.env.ATLAS_DOMAIN_CORE;
  record('flag default OFF', isDomainCoreEnabled() === false);
  process.env.ATLAS_DOMAIN_CORE = 'true';
  record('flag ON when true', isDomainCoreEnabled() === true);
  delete process.env.ATLAS_DOMAIN_CORE;
  delete process.env.ATLAS_DOMAIN_CORE_DUAL_RUN;
  record('dual-run default OFF', isDomainCoreDualRunEnabled() === false);
  process.env.ATLAS_DOMAIN_CORE_DUAL_RUN = '1';
  record('dual-run ON when 1', isDomainCoreDualRunEnabled() === true);
  delete process.env.ATLAS_DOMAIN_CORE_DUAL_RUN;
  if (prev === undefined) delete process.env.ATLAS_DOMAIN_CORE;
  else process.env.ATLAS_DOMAIN_CORE = prev;
}

console.log('\n=== Registries ===\n');
{
  const engines = listEngines();
  const ids = engines.map((e) => e.engineId);
  record(
    'listEngines live ids',
    ids.includes('atlas-numerology') &&
      ids.includes('atlas-tarot') &&
      ids.includes('atlas-dream') &&
      ids.includes('atlas-symbolic-latin') &&
      ids.includes('atlas-daily-time'),
    ids.join(','),
  );
  record(
    'getEngine numerology',
    getEngine('atlas-numerology')?.hasAdapter === true,
  );
}

{
  const resolved = resolveMethodology('numerology');
  record(
    'default Pythagorean methodology',
    resolved.methodology?.methodologyId ===
      ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId &&
      resolved.selectionReason.includes('default'),
  );
  record(
    'listMethodologies non-empty',
    listMethodologies().length >= 5,
  );
}

{
  const src = getSource('src.numerology.pythagorean-profiles');
  record('sourceId resolves', Boolean(src?.sourceId));
  const pack = resolveSources([
    'src.numerology.pythagorean-profiles',
    'missing.source',
  ]);
  record(
    'resolveSources reports missing',
    pack.resolved.length === 1 && pack.missing.includes('missing.source'),
  );
}

console.log('\n=== Depth resolver ===\n');
{
  record('detaylı → L3', resolveDepthFromMessage('Bunu detaylı anlat') === 'L3');
  record('kısa → L1', resolveDepthFromMessage('Kısaca söyle') === 'L1');
  record('default → L2', resolveDepthFromMessage('Numeroloji nedir?') === 'L2');
  record(
    'hint L4 wins',
    resolveDepthLevel({ depthHint: 'L4', message: 'kısa' }) === 'L4',
  );
}

console.log('\n=== StructuredAnalysisOutput schema ===\n');
{
  const sample = createEmptyStructuredOutput({
    engineId: 'atlas-numerology',
    engineVersion: 'test',
    domain: 'numerology',
    intent: 'fixture',
    methodologyId: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
    rulesetVersion: ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.rulesetVersion,
    selectionReason: 'fixture',
  });
  sample.calculations.push({
    calcId: 'life_path',
    label: 'Life Path',
    value: 7,
    evidenceType: 'deterministic_calculation',
  });
  const v = validateStructuredAnalysisOutput(sample);
  record(
    'schema fixture validates',
    v.ok && sample.schemaVersion === STRUCTURED_ANALYSIS_SCHEMA_VERSION,
    v.errors.join('; '),
  );
  const bad = validateStructuredAnalysisOutput({ schemaVersion: '0' });
  record('invalid schema rejected', bad.ok === false && bad.errors.length > 0);
}

console.log('\n=== Numerology adapter dual-run ===\n');
{
  record('adapter version set', Boolean(NUMEROLOGY_ADAPTER_VERSION));
  const birthDate = '1990-05-12';
  const dual = dualRunNumerologyCalculations({ birthDate });
  const direct = computeBirthNumerologyChart(birthDate);
  record(
    'dual-run calc equality',
    dual.equal === true &&
      dual.viaAdapter.lifePath?.value === direct.lifePath?.value,
    `lp=${dual.viaAdapter.lifePath?.value}`,
  );

  const adapted = runNumerologyAdapter({
    birthDate,
    request: {
      channel: 'api',
      message: 'Doğum numerolojim',
      depthHint: 'L2',
    },
  });
  record(
    'adapter StructuredAnalysisOutput valid',
    adapted.ok && adapted.validation.ok,
    adapted.validation.errors.join('; '),
  );
  record(
    'adapter methodologyId stable',
    adapted.output?.methodology?.id ===
      ATLAS_PYTHAGOREAN_BIRTH_METHODOLOGY.methodologyId,
  );
  record(
    'adapter life_path calculation present',
    adapted.output?.calculations?.some(
      (c) => c.calcId === 'life_path' && c.value != null,
    ),
  );
}

console.log('\n=== Summary ===\n');
console.log(`Domain Core tests: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error('Failures:', failures.join(', '));
  process.exit(1);
}

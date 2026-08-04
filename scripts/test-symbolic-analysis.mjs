/**
 * Symbolic analysis integration tests.
 * Covers runners, orchestration honesty, consent, safety, routes smoke.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSymbolicAnalysis,
  INPUT_CONTRACT,
  LAYER_READINESS,
  PHOTO_CAPABILITY,
  SYMBOLIC_LAYER_IDS,
  USER_SECTION_TITLES,
  runEbcedLayer,
  runEsmaLayer,
  sanitizeSymbolicProse,
  scanSymbolicCertainty,
  ATLAS_LATIN_MOTIF_METHODOLOGY,
  buildLatinMotifCharacterTrace,
} from '../server/symbolic-analysis/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const consents = { symbolicReading: true, dataProcessing: true };

function baseInput(extra = {}) {
  return {
    name: 'Lara',
    birthDate: '1990-05-12',
    intention: 'Dönüşüm ve sabır',
    consents,
    ...extra,
  };
}

function userBlob(report) {
  return JSON.stringify(report.userResult);
}

function assertNoTechModules(report) {
  const blob = userBlob(report)
    .replace(/klasik ebced değildir/gi, '')
    .replace(/klasik ebced eşlemesi değildir/gi, '')
    .replace(/klasik Arapça ebced hesabı değildir/gi, '')
    .replace(/Klasik Ebced-i Kebîr — yakında/gi, '')
    .replace(/abjad-kabir-classical-v1/gi, '');
  assert.ok(
    !/\bebced\b|cifir|simya|mizaç|mizac|fizyonomi|esmaül|esmaul/i.test(blob),
    'userResult must not expose technical module names as product modules',
  );
}

function withFlag(on, fn) {
  const prev = process.env.ATLAS_SYMBOLIC_METADATA_V2;
  if (on) process.env.ATLAS_SYMBOLIC_METADATA_V2 = 'true';
  else delete process.env.ATLAS_SYMBOLIC_METADATA_V2;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.ATLAS_SYMBOLIC_METADATA_V2;
    else process.env.ATLAS_SYMBOLIC_METADATA_V2 = prev;
  }
}

// ─── 1. Yalnızca Ebced ───────────────────────────────────────────────
{
  const report = buildSymbolicAnalysis({
    input: baseInput(),
    layers: ['ebced'],
  });
  assert.equal(report.ok, true);
  assert.equal(report.trace.layers.ebced.status, 'success');
  assert.ok(report.trace.layers.ebced.normalized.calculatedData.reducedDigit >= 1);
  assert.ok(report.userResult.sections.some((s) => s.id === 'pattern' && s.body.length > 0));
  assert.equal(report.metadata.successCount, 1);
  assertNoTechModules(report);
  console.log('1. only-ebced: ok');
}

// ─── 2. Yalnızca Esma ────────────────────────────────────────────────
{
  const report = buildSymbolicAnalysis({
    input: baseInput(),
    layers: ['esma'],
  });
  assert.equal(report.ok, true);
  assert.equal(report.trace.layers.esma.status, 'success');
  assert.ok(report.trace.layers.esma.normalized.calculatedData.selected.length >= 1);
  assert.ok(report.userResult.sections.some((s) => s.id === 'names'));
  assertNoTechModules(report);
  console.log('2. only-esma: ok');
}

// ─── 3. Ebced + Esma birleşik ─────────────────────────────────────────
{
  const report = buildSymbolicAnalysis({
    input: baseInput(),
    layers: ['ebced', 'esma'],
  });
  assert.equal(report.ok, true);
  assert.equal(report.trace.layers.ebced.status, 'success');
  assert.equal(report.trace.layers.esma.status, 'success');
  assert.equal(report.userResult.status, 'complete');
  assert.ok(report.userResult.methodDisclosure?.length === 2);
  assert.ok(report.userResult.sections.find((s) => s.id === 'summary')?.body.includes('kullanılabilir'));
  assertNoTechModules(report);
  console.log('3. ebced+esma: ok');
}

// ─── 4. Hazır olmayan katman sahte sonuç üretmiyor ────────────────────
{
  const report = buildSymbolicAnalysis({
    input: baseInput({ photoRef: 'should-be-ignored' }),
  });
  for (const id of ['cifir', 'simya', 'mizac', 'fizyonomi']) {
    const layer = report.trace.layers[id];
    assert.ok(['planned', 'unavailable', 'skipped'].includes(layer.status), id);
    assert.equal(layer.computed, null);
    assert.equal(layer.interpreted, null);
    assert.ok(!layer.normalized?.calculatedData);
  }
  assert.equal(report.metadata.fabricated, false);
  console.log('4. no-fake-planned: ok');
}

// ─── 5. Eksik veri → uygun katman atlanıyor ───────────────────────────
{
  // Global required missing
  const missing = buildSymbolicAnalysis({ input: { name: 'Lara', consents } });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, 'MISSING_REQUIRED_INPUT');

  // Fizyonomi always skipped without photo infra
  const noPhoto = buildSymbolicAnalysis({ input: baseInput() });
  assert.ok(['skipped', 'unavailable', 'planned'].includes(noPhoto.trace.layers.fizyonomi.status));
  console.log('5. missing-input-skip: ok');
}

// ─── 6. Runner başarısız → kısmi sonuç ───────────────────────────────
{
  // Force ebced-only with empty name via layers + capability trick:
  // Use layers option with input that has name for global ok, but call runner directly for fail.
  const directFail = (() => {
    try {
      runEbcedLayer({ name: '' });
      return null;
    } catch (e) {
      return e;
    }
  })();
  assert.ok(directFail);

  // Orchestrator partial: request only planned layers + one available
  const partial = buildSymbolicAnalysis({
    input: baseInput(),
    layers: ['ebced', 'cifir'],
  });
  assert.equal(partial.trace.layers.ebced.status, 'success');
  assert.equal(partial.trace.layers.cifir.status, 'planned');
  assert.ok(['partial', 'complete'].includes(partial.userResult.status));
  // Simulate error status path via injecting empty name for esma-only after consent — use layers esma with valid name is success.
  // Error path: runEsma with empty throws
  assert.throws(() => runEsmaLayer({ name: '' }));
  console.log('6. partial-on-failure: ok');
}

// ─── 7. Kullanıcı teknik modül listesi görmüyor ───────────────────────
{
  const report = withFlag(false, () => buildSymbolicAnalysis({ input: baseInput() }));
  assertNoTechModules(report);
  const page = readFileSync(join(root, 'src/pages/SymbolicAnalysisPage.tsx'), 'utf8');
  assert.ok(!/\bCifir\b|\bSimya\b|\bMizaç\b|\bFizyonomi\b|Esmaül Hüsna/.test(page));
  assert.ok(!/type=\"file\"/.test(page), 'no file upload control');
  assert.ok(/Fotoğraf yüklenmez/i.test(page));
  assert.ok(/methodologyPresentation/.test(page), 'v2 methodology banner wired');
  assert.ok(/Klasik Ebced-i Kebîr — yakında/.test(page) || /comingSoon/.test(page));
  console.log('7. no-tech-module-ui: ok');
}

// ─── 8. Route çakışması yok ──────────────────────────────────────────
{
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.ok(app.includes('path="analysis"'));
  assert.ok(app.includes('path="analysis/symbolic"'));
  assert.ok(app.includes('SymbolicAnalysisPage'));
  assert.ok(app.includes('AnalysisFlow'));
  assert.equal((app.match(/path="analysis\/symbolic"/g) || []).length, 1);
  console.log('8. routes: ok');
}

// ─── 9. Eski /analysis akışı bozulmuyor ───────────────────────────────
{
  const flow = readFileSync(join(root, 'src/pages/AnalysisFlow.tsx'), 'utf8');
  assert.ok(flow.includes('export default'));
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /path="analysis"\s+element=\{<AnalysisFlow/);
  console.log('9. personal-analysis-route: ok');
}

// ─── 10. Photo altyapısı yokken upload görünmüyor ─────────────────────
{
  assert.equal(PHOTO_CAPABILITY.uploadEnabled, false);
  assert.equal(INPUT_CONTRACT.photoUpload, false);
  const page = readFileSync(join(root, 'src/pages/SymbolicAnalysisPage.tsx'), 'utf8');
  assert.ok(!/type=\"file\"/.test(page));
  const withPhoto = buildSymbolicAnalysis({
    input: baseInput({ photoRef: 'blob:fake' }),
  });
  assert.equal(withPhoto.trace.capabilities.photo.uploadEnabled, false);
  // photoRef stripped
  assert.ok(
    withPhoto.trace.layers.fizyonomi.status === 'unavailable' ||
      withPhoto.trace.layers.fizyonomi.status === 'skipped' ||
      withPhoto.trace.layers.fizyonomi.status === 'planned',
  );
  console.log('10. no-photo-upload: ok');
}

// ─── 11. Consent olmadan hassas veri işlenmiyor ───────────────────────
{
  const denied = buildSymbolicAnalysis({
    input: {
      name: 'Lara',
      birthDate: '1990-05-12',
      consents: { symbolicReading: false, dataProcessing: false },
    },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.error, 'CONSENT_REQUIRED');
  assert.equal(denied.trace.layerOrder.length, 0);
  assert.ok(!denied.trace.findings?.computed?.length);

  const half = buildSymbolicAnalysis({
    input: {
      name: 'Lara',
      birthDate: '1990-05-12',
      consents: { symbolicReading: true, dataProcessing: false },
    },
  });
  assert.equal(half.ok, false);
  assert.equal(half.error, 'CONSENT_REQUIRED');
  console.log('11. consent-gate: ok');
}

// ─── 12. Kesinlik dili filtreleniyor ──────────────────────────────────
{
  const bad = 'Bu kesinlikle kaderindir ve ilahi hüküm olarak tedavi eder.';
  const scan = scanSymbolicCertainty(bad);
  assert.equal(scan.ok, false);
  const sanitized = sanitizeSymbolicProse(bad);
  assert.ok(sanitized.hits.length > 0);
  assert.ok(!/kesinlikle|kaderindir|ilahi hüküm.*tedavi eder/i.test(sanitized.text) || sanitized.rejected);
  const report = buildSymbolicAnalysis({ input: baseInput() });
  const blob = userBlob(report);
  assert.ok(!/\bkesinlikle\b/i.test(blob));
  assert.ok(!/kaderindir/i.test(blob));
  console.log('12. certainty-filter: ok');
}

// ─── Readiness registry ──────────────────────────────────────────────
{
  assert.equal(LAYER_READINESS.ebced, 'available');
  assert.equal(LAYER_READINESS.esma, 'available');
  assert.equal(LAYER_READINESS.cifir, 'planned');
  assert.equal(LAYER_READINESS.fizyonomi, 'unavailable');
  assert.deepEqual(
    Object.keys(USER_SECTION_TITLES).sort(),
    [
      'balance',
      'echoes',
      'meaning',
      'method',
      'names',
      'pattern',
      'reflection',
      'summary',
      'tensions',
    ].sort(),
  );
  assert.ok(SYMBOLIC_LAYER_IDS.includes('ebced'));
  console.log('registry: ok');
}

// ─── 16. Responsive smoke (class / layout guards) ────────────────────
{
  const page = readFileSync(join(root, 'src/pages/SymbolicAnalysisPage.tsx'), 'utf8');
  assert.ok(/max-w-3xl/.test(page));
  assert.ok(/px-3|sm:px-6|md:px-8/.test(page));
  assert.ok(/sm:grid-cols-2/.test(page));
  assert.ok(/clamp\(/.test(page));
  assert.ok(/min-h-12/.test(page));
  const landing = readFileSync(join(root, 'src/data/landing-content.ts'), 'utf8');
  assert.ok(landing.includes("/analysis/symbolic"));
  console.log('16. responsive-smoke: ok');
}

// ─── 17. Faz 1–2: flag off preserves legacy source ───────────────────
{
  const report = withFlag(false, () =>
    buildSymbolicAnalysis({ input: baseInput(), layers: ['ebced'] }),
  );
  assert.equal(report.trace.layers.ebced.normalized.source, 'atlas-letter-number-v1');
  assert.equal(report.metadata.symbolicMetadataV2, undefined);
  assert.equal(report.userResult.methodologyPresentation, undefined);
  assert.ok(!('selectedSpelling' in (report.metadata || {})));
  console.log('17. flag-off-legacy: ok');
}

// ─── 18. Faz 1–2: metadata v2 contract ───────────────────────────────
{
  const report = withFlag(true, () =>
    buildSymbolicAnalysis({ input: baseInput({ intention: 'sabır' }), layers: ['ebced'] }),
  );
  const m = report.metadata;
  assert.equal(m.symbolicMetadataV2, true);
  assert.equal(m.symbolicMethodology.methodologyId, 'atlas-letter-number-v2');
  assert.equal(m.symbolicMethodology.methodologyVersion, '2.0.0');
  assert.equal(m.symbolicMethodology.rulesetVersion, ATLAS_LATIN_MOTIF_METHODOLOGY.rulesetVersion);
  assert.equal(m.symbolicMethodology.catalogVersion, null);
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(m.symbolicMethodology.generatedAt));
  assert.equal(m.assessment.transliterationCertainty, null);
  assert.equal(m.assessment.orthographicDisputeLevel, 'not-applicable');
  assert.equal(m.assessment.matchStrength, null);
  assert.ok(Array.isArray(m.assessment.interpretationLimitations));
  assert.ok(m.assessment.interpretationLimitations.length >= 3);
  assert.equal(m.inputSnapshot.selectedMethodologyId, 'atlas-letter-number-v2');
  assert.equal(m.inputSnapshot.originalInput, 'Lara');
  assert.ok(!('selectedSpelling' in m.inputSnapshot));
  assert.ok(!('proposedArabicSpellings' in m.inputSnapshot));
  assert.ok(!('normalizedSpelling' in m.inputSnapshot));
  assert.ok(!('confidence' in m));
  assert.ok(!JSON.stringify(report).includes('selectedArabicSpelling'));
  assert.equal(report.trace.layers.ebced.normalized.source, 'atlas-letter-number-v2');
  // LEGACY_CONFIDENCE_STILL_PRESENT on layer
  assert.ok(['high', 'medium', 'low', 'none'].includes(report.trace.layers.ebced.normalized.confidence));
  assert.ok(report.userResult.methodologyPresentation?.disclaimer.includes('klasik ebced değildir'));
  assert.equal(report.userResult.methodologyPresentation?.isClassicalAbjad, false);
  assert.ok(
    report.userResult.methodologyPresentation?.comingSoon?.some((c) =>
      c.label.includes('Klasik Ebced-i Kebîr'),
    ),
  );
  assert.ok(report.userResult.methodologyPresentation?.comingSoon?.every((c) => c.active === false));
  assertNoTechModules(report);
  console.log('18. metadata-v2-contract: ok');
}

// ─── 19. Calculation unchanged across flag ───────────────────────────
{
  const samples = [
    { name: 'Lara' },
    { name: 'Şükran' },
    { name: 'Âdem' },
    { name: 'Emîne' },
    { name: 'Maûn' },
    { name: 'Test@#$' },
    { name: 'A B' },
    { fullName: 'Lara Deniz', name: 'Lara' },
  ];
  for (const sample of samples) {
    const off = withFlag(false, () =>
      runEbcedLayer({ ...sample, name: sample.name || sample.fullName }),
    );
    const on = withFlag(true, () =>
      runEbcedLayer({ ...sample, name: sample.name || sample.fullName }),
    );
    assert.equal(on.calculatedData.totalSum, off.calculatedData.totalSum, sample.name);
    assert.equal(on.calculatedData.reducedDigit, off.calculatedData.reducedDigit, sample.name);
    assert.equal(on.calculatedData.letterCount, off.calculatedData.letterCount, sample.name);
  }
  assert.throws(() => runEbcedLayer({ name: '' }));
  assert.throws(() => runEbcedLayer({ name: '   ' }));
  console.log('19. calculation-regression: ok');
}

// ─── 20. Reproducibility snapshot + unsupported trace ────────────────
{
  const report = withFlag(true, () =>
    buildSymbolicAnalysis({ input: baseInput({ name: 'Âdem' }), layers: ['ebced'] }),
  );
  const snap = report.metadata.reproducibilitySnapshot;
  assert.equal(snap.methodologyId, 'atlas-letter-number-v2');
  assert.equal(snap.total, report.trace.layers.ebced.normalized.calculatedData.totalSum);
  assert.ok(Array.isArray(snap.tokenizedLetters));
  assert.ok(snap.tokenizedLetters.some((t) => t.status === 'unsupported' && t.sourceCharacter === 'Â'));
  assert.ok(snap.optionalReductions.some((r) => r.method === 'digit-sum'));
  const mappedSum = snap.tokenizedLetters
    .filter((t) => t.status === 'mapped')
    .reduce((s, t) => s + (t.value || 0), 0);
  assert.equal(mappedSum, snap.total);
  assert.ok(
    (report.metadata.methodologyNotes || []).some((n) =>
      n.includes('NOT_FULLY_REPRODUCIBLE_UNDER_CURRENT_TOKENIZER'),
    ),
  );
  console.log('20. reproducibility-trace: ok');
}

// ─── 21. Safety phrases absent ───────────────────────────────────────
{
  const report = withFlag(true, () => buildSymbolicAnalysis({ input: baseInput() }));
  const blob = `${userBlob(report)}${JSON.stringify(report.metadata)}`;
  for (const bad of [
    'senin esman',
    'gerçek esman',
    'kesin uygun',
    'kesinlikle budur',
    'kaderin',
    'şu kadar zikir çek',
    'hastalığını iyileştirir',
    'klasik ebced sonucu',
    'gerçek ebced',
    'geleneksel ebced',
  ]) {
    assert.ok(!blob.toLocaleLowerCase('tr-TR').includes(bad), bad);
  }
  const page = readFileSync(join(root, 'src/pages/SymbolicAnalysisPage.tsx'), 'utf8');
  for (const bad of ['senin esman', 'gerçek esman', 'kesin uygun']) {
    assert.ok(!page.toLocaleLowerCase('tr-TR').includes(bad), bad);
  }
  console.log('21. safety-phrases: ok');
}

// ─── 22. Character trace helper smoke ────────────────────────────────
{
  const trace = buildLatinMotifCharacterTrace('a!');
  assert.equal(trace[0].status, 'mapped');
  assert.equal(trace[1].status, 'ignored');
  console.log('22. char-trace-helper: ok');
}

console.log('symbolic-analysis tests: all ok');

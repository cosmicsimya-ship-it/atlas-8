/**
 * Classical Abjad Faz 3 — fixture + flag/shadow regression tests.
 * Does not mutate fixture expected totals.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSymbolicAnalysis,
  __setClassicalAbjadShadowTestHooks,
  runClassicalAbjad,
  runEbcedLayer,
  tokenizeClassicalSpelling,
  buildClassicalShadowSummary,
  CLASSICAL_ABJAD_METHODOLOGY,
  CLASSICAL_ERROR_CODES,
  isClassicalAbjadShadowEnabled,
  getClassicalAbjadFlagMode,
} from '../server/symbolic-analysis/index.js';
import { ARABIC_ABJAD } from '../server/symbolic-analysis/data/ebced-table.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const fixturesPath = join(root, 'tests/fixtures/classical-abjad-fixtures.json');
const data = JSON.parse(readFileSync(fixturesPath, 'utf8'));

const consents = { symbolicReading: true, dataProcessing: true };

function withEnv(overrides, fn) {
  const prev = {};
  for (const key of Object.keys(overrides)) {
    prev[key] = process.env[key];
    const val = overrides[key];
    if (val === undefined || val === null) delete process.env[key];
    else process.env[key] = String(val);
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

function lettersEqual(actual, expected) {
  assert.equal(actual.length, expected.length, 'letter count mismatch');
  for (let i = 0; i < expected.length; i += 1) {
    assert.equal(actual[i].letter, expected[i].letter, `letter[${i}]`);
    assert.equal(actual[i].value, expected[i].value, `value[${i}]`);
  }
}

// ─── L0 stamp ────────────────────────────────────────────────────────
{
  assert.equal(data.methodologyId, 'abjad-kabir-classical-v1');
  assert.equal(data.methodologyVersion, '1.0.0');
  assert.equal(data.rulesetVersion, 'classical-kabir-rules-1.0.0');
  assert.equal(CLASSICAL_ABJAD_METHODOLOGY.methodologyId, data.methodologyId);
  assert.equal(CLASSICAL_ABJAD_METHODOLOGY.rulesetVersion, data.rulesetVersion);
  assert.ok(data.deprecatedMethodologyAliases.includes('classical-arabic-abjad-kabir-v1'));
  assert.equal(data.optionalDigitReductionPolicy.enabledForClassicalPrimary, false);
  assert.equal(data.fixtures.length, 26);
  console.log('L0 stamp: ok');
}

// ─── Production table regression: آ=1 untouched ──────────────────────
{
  assert.equal(ARABIC_ABJAD['آ'], 1, 'production ARABIC_ABJAD آ must remain 1');
  console.log('production آ=1 preserved: ok');
}

let numericPass = 0;
const expandIds = ['FAB-003', 'FAB-012a', 'FAB-CONFLICT-AA'];

for (const fx of data.fixtures) {
  // FAB-021: confirmation gate (blocked numeric)
  if (fx.id === 'FAB-021') {
    const result = runClassicalAbjad({
      selectedSpelling: fx.inputArabic || null,
      spellingConfirmed: false,
      forceConfirmationRequired: true,
      originalInput: fx.inputLatin,
    });
    assert.equal(result.status, 'pending_confirmation');
    assert.equal(result.complete, false);
    assert.equal(result.errorCode, fx.expectError);
    assert.equal(result.total, null);
    assert.equal(result.digitReductionApplied, false);
    console.log(`${fx.id}: confirmation gate ok`);
    continue;
  }

  // FAB-013: unsupported
  if (fx.id === 'FAB-013') {
    const spelling = `${fx.inputLatin || ''}`.includes('★')
      ? 'علي★'
      : `علي${(fx.unsupportedCharacters || ['★'])[0]}`;
    const result = runClassicalAbjad({
      selectedSpelling: spelling,
      spellingConfirmed: true,
    });
    assert.equal(result.status, 'error');
    assert.equal(result.complete, false);
    assert.equal(result.total, null);
    assert.ok(
      result.errorCode === CLASSICAL_ERROR_CODES.TRANSLITERATION_UNSUPPORTED_CHAR ||
        result.errorCode === fx.expectError,
    );
    assert.ok((result.unsupportedCharacters || []).includes('★'));
    console.log(`${fx.id}: unsupported error ok`);
    continue;
  }

  // Mother-name parts
  if (Array.isArray(fx.parts) && fx.parts.length) {
    const result = runClassicalAbjad({
      includeMotherName: fx.includeMotherName === true,
      parts: fx.parts.map((p) => ({
        type: p.type,
        selectedSpelling: p.selectedSpelling,
        confirmed: true,
      })),
    });
    assert.equal(result.status, 'complete', fx.id);
    assert.equal(result.digitReductionApplied, false);
    assert.equal(result.optionalReductions.length, 0);
    assert.equal(result.metadata.digitMotifsUsed, false);
    assert.equal(result.metadata.latinTableUsed, false);
    assert.equal(result.metadata.esmaSelectionPerformed, false);
    assert.equal(result.parts.length, fx.parts.length);

    for (let i = 0; i < fx.parts.length; i += 1) {
      const expected = fx.parts[i];
      const actual = result.parts[i];
      assert.equal(actual.type, expected.type);
      assert.equal(actual.selectedSpelling, expected.selectedSpelling);
      assert.equal(actual.subtotal, expected.subtotal);
      lettersEqual(actual.fixtureLetters, expected.letters);
    }

    if (fx.includeMotherName === true) {
      assert.equal(result.combinedTotal, fx.combinedTotal);
      assert.equal(result.total, fx.expectedTotal);
    } else {
      assert.equal(result.combinedTotal, null);
      assert.equal(result.total, fx.expectedTotal);
    }
    numericPass += 1;
    console.log(`${fx.id}: parts ok (total=${result.total})`);
    continue;
  }

  if (typeof fx.expectedTotal !== 'number') {
    console.log(`${fx.id}: skip non-numeric`);
    continue;
  }

  const result = runClassicalAbjad({
    selectedSpelling: fx.inputArabic,
    spellingConfirmed: true,
  });
  assert.equal(result.status, 'complete', `${fx.id} status`);
  assert.equal(result.ok, true);
  assert.equal(result.total, fx.expectedTotal, `${fx.id} total`);
  lettersEqual(result.fixtureLetters, fx.letters);
  assert.equal(result.digitReductionApplied, false);
  assert.equal(result.optionalReductions.length, 0);
  assert.equal(result.metadata.latinTableUsed, false);
  assert.equal(result.metadata.esmaSelectionPerformed, false);
  assert.equal(result.rulesetVersion, 'classical-kabir-rules-1.0.0');

  if (expandIds.includes(fx.id)) {
    assert.equal(result.metadata.hadAlifMadda, true, `${fx.id} alif madda`);
    const tokenized = tokenizeClassicalSpelling(fx.inputArabic);
    assert.ok(tokenized.letters.filter((l) => l.expandedFrom === 'آ').length >= 2);
  }

  if (fx.id === 'FAB-006') {
    assert.equal(result.fixtureLetters[0].letter, 'ء');
    assert.equal(result.fixtureLetters[0].value, 0);
    assert.equal(result.metadata.hadStandaloneHamza, true);
    assert.equal(result.metadata.standaloneHamzaPolicy.policy, 'zero-value-but-traced');
    assert.equal(result.metadata.standaloneHamzaPolicy.atlasProductDecision, true);
  }

  if (fx.id === 'FAB-005') {
    assert.ok(result.letters.some((l) => l.ruleApplied === 'shadda-expand-and-count'));
  }

  if (fx.id === 'FAB-019') {
    assert.ok(result.normalizedSpelling === 'رحمن' || result.total === 298);
    assert.ok(
      (result.ignoredTrace || []).some((t) => t.ruleApplied === 'harakat-ignore'),
      'harakat must be traced, not silently dropped',
    );
  }

  numericPass += 1;
  console.log(`${fx.id}: ok (total=${result.total})`);
}

assert.equal(numericPass, 24, `expected 24 numeric fixtures, got ${numericPass}`);
console.log(`numeric fixtures: ${numericPass}/24 ok`);

// ─── Confirmation without auto-accept ────────────────────────────────
{
  const pending = runClassicalAbjad({
    selectedSpelling: 'محمد',
    spellingConfirmed: false,
  });
  assert.equal(pending.status, 'pending_confirmation');
  assert.equal(pending.total, null);
  assert.equal(pending.errorCode, CLASSICAL_ERROR_CODES.CONFIRMATION_REQUIRED);
  console.log('confirmation gate (unconfirmed spelling): ok');
}

// ─── Classical primary: no digit reduction field as primary ──────────
{
  const result = runClassicalAbjad({ selectedSpelling: 'محمد', spellingConfirmed: true });
  assert.equal(result.total, 92);
  assert.equal(result.digitReductionApplied, false);
  assert.equal('reducedDigit' in result, false);
  console.log('classical primary no digit reduction: ok');
}

// ─── Feature flag OFF regression ─────────────────────────────────────
{
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: undefined, ATLAS_CLASSICAL_ABJAD_SHADOW: undefined }, () => {
    assert.equal(getClassicalAbjadFlagMode(), 'off');
    assert.equal(isClassicalAbjadShadowEnabled(), false);
    const latin = runEbcedLayer({ name: 'Lara' });
    assert.ok(latin.calculatedData.totalSum > 0);
    assert.ok(latin.calculatedData.reducedDigit >= 1);
    const report = buildSymbolicAnalysis({
      input: {
        name: 'Lara',
        birthDate: '1990-05-12',
        intention: 'test',
        consents,
      },
      layers: ['ebced'],
    });
    assert.equal(report.ok, true);
    assert.equal(report.metadata.classicalAbjadShadow, undefined);
    assert.equal(report.trace.layers.ebced.status, 'success');
    assert.ok(report.userResult.sections.length >= 1);
  });
  console.log('feature flag OFF regression: ok');
}

// ─── Shadow mode does not change userResult ──────────────────────────
{
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'shadow' }, () => {
    const input = {
      name: 'محمد',
      fullName: 'محمد',
      birthDate: '1990-05-12',
      intention: 'test',
      selectedSpelling: 'محمد',
      spellingConfirmed: true,
      consents,
    };
    const off = withEnv({ ATLAS_CLASSICAL_ABJAD_V1: undefined }, () =>
      buildSymbolicAnalysis({ input, layers: ['ebced'] }),
    );
    const on = buildSymbolicAnalysis({ input, layers: ['ebced'] });
    assert.ok(on.metadata.classicalAbjadShadow);
    assert.equal(on.metadata.classicalAbjadShadow.userResultUnchanged, true);
    assert.equal(on.metadata.classicalAbjadShadow.compare.total, 92);
    assert.deepEqual(on.userResult, off.userResult);
    assert.equal(
      on.trace.layers.ebced.normalized.calculatedData.totalSum,
      off.trace.layers.ebced.normalized.calculatedData.totalSum,
    );
    assert.equal(
      on.trace.layers.ebced.normalized.calculatedData.reducedDigit,
      off.trace.layers.ebced.normalized.calculatedData.reducedDigit,
    );
  });
  console.log('shadow mode userResult unchanged: ok');
}

// ─── Shadow آ divergence vs production table ─────────────────────────
{
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'true' }, () => {
    const report = buildSymbolicAnalysis({
      input: {
        name: 'آ',
        fullName: 'آ',
        birthDate: '1990-01-01',
        intention: 'test',
        selectedSpelling: 'آ',
        spellingConfirmed: true,
        consents,
      },
      layers: ['ebced'],
    });
    const cmp = report.metadata.classicalAbjadShadow.compare;
    assert.equal(cmp.hadAlifMadda, true);
    assert.equal(cmp.total, 2);
    assert.equal(cmp.productionAlifMaddaValue, 1);
    assert.equal(cmp.alifMaddaDivergence, true);
  });
  console.log('shadow آ divergence metadata: ok');
}

// ─── Latin engine still uses production table for آ ──────────────────
{
  const latin = runEbcedLayer({ name: 'آ' });
  assert.equal(latin.calculatedData.parts[0].sum, 1);
  console.log('Latin/production آ=1 path unchanged: ok');
}

function assertNoShadowPii(blob) {
  const text = typeof blob === 'string' ? blob : JSON.stringify(blob);
  assert.equal(text.includes('selectedSpelling'), false, 'PII selectedSpelling');
  assert.equal(text.includes('fullName'), false, 'PII fullName');
  assert.equal(text.includes('motherName'), false, 'PII motherName');
  assert.equal(text.includes('inputArabic'), false, 'PII inputArabic');
  assert.equal(text.includes('"letters"'), false, 'PII letters');
  assert.equal(text.includes('stack'), false, 'PII stack');
  assert.equal(text.includes('SHADOW_BOOM'), false, 'error message leak');
  assert.equal(/[\u0600-\u06FF]/.test(text), false, 'Arabic script in shadow payload');
}

// ─── A. Shadow runner throw → Latin userResult intact ────────────────
{
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'true' }, () => {
    const input = {
      name: 'Lara',
      fullName: 'Lara',
      birthDate: '1990-05-12',
      intention: 'test',
      selectedSpelling: 'محمد',
      spellingConfirmed: true,
      motherName: 'Fatima',
      consents,
    };
    const baseline = withEnv({ ATLAS_CLASSICAL_ABJAD_V1: undefined }, () =>
      buildSymbolicAnalysis({ input, layers: ['ebced'] }),
    );

    __setClassicalAbjadShadowTestHooks({
      runClassicalAbjad: () => {
        throw new Error('SHADOW_BOOM selectedSpelling=محمد fullName=Lara motherName=Fatima');
      },
    });
    let report;
    try {
      assert.doesNotThrow(() => {
        report = buildSymbolicAnalysis({ input, layers: ['ebced'] });
      });
      assert.equal(report.ok, true);
      assert.deepEqual(report.userResult, baseline.userResult);
      assert.ok(report.metadata.classicalAbjadShadow);
      assert.equal(report.metadata.classicalAbjadShadow.userResultUnchanged, true);
      assert.equal(report.metadata.classicalAbjadShadow.compare.status, 'error');
      assert.equal(
        report.metadata.classicalAbjadShadow.compare.methodologyId,
        CLASSICAL_ABJAD_METHODOLOGY.methodologyId,
      );
      assert.equal(
        report.metadata.classicalAbjadShadow.compare.rulesetVersion,
        CLASSICAL_ABJAD_METHODOLOGY.rulesetVersion,
      );
      assert.equal(
        report.metadata.classicalAbjadShadow.compare.errorCode,
        'CLASSICAL_SHADOW_UNAVAILABLE',
      );
      assertNoShadowPii(report.metadata.classicalAbjadShadow);
    } finally {
      __setClassicalAbjadShadowTestHooks(null);
    }
  });
  console.log('A. shadow runner exception isolation: ok');
}

// ─── B. Shadow summary throw → Latin userResult intact ───────────────
{
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'shadow' }, () => {
    const input = {
      name: 'Lara',
      birthDate: '1990-05-12',
      intention: 'test',
      selectedSpelling: 'محمد',
      spellingConfirmed: true,
      consents,
    };
    const baseline = withEnv({ ATLAS_CLASSICAL_ABJAD_V1: undefined }, () =>
      buildSymbolicAnalysis({ input, layers: ['ebced'] }),
    );

    __setClassicalAbjadShadowTestHooks({
      buildClassicalShadowSummary: () => {
        throw new Error('SUMMARY_BOOM stack=secret selectedSpelling=محمد');
      },
    });
    let report;
    try {
      assert.doesNotThrow(() => {
        report = buildSymbolicAnalysis({ input, layers: ['ebced'] });
      });
      assert.equal(report.ok, true);
      assert.deepEqual(report.userResult, baseline.userResult);
      assert.equal(report.trace.layers.ebced.status, 'success');
      assert.ok(report.metadata.classicalAbjadShadow);
      assert.equal(report.metadata.classicalAbjadShadow.compare.status, 'error');
      assertNoShadowPii(report.metadata.classicalAbjadShadow);
    } finally {
      __setClassicalAbjadShadowTestHooks(null);
    }
  });
  console.log('B. shadow summary exception isolation: ok');
}

// ─── B2. Shadow log throw → analysis completes ───────────────────────
{
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'true' }, () => {
    const input = {
      name: 'Lara',
      birthDate: '1990-05-12',
      intention: 'test',
      selectedSpelling: 'محمد',
      spellingConfirmed: true,
      consents,
    };
    const baseline = withEnv({ ATLAS_CLASSICAL_ABJAD_V1: undefined }, () =>
      buildSymbolicAnalysis({ input, layers: ['ebced'] }),
    );
    const origInfo = console.info;
    console.info = () => {
      throw new Error('LOG_BOOM selectedSpelling=محمد');
    };
    let report;
    try {
      assert.doesNotThrow(() => {
        report = buildSymbolicAnalysis({ input, layers: ['ebced'] });
      });
      assert.equal(report.ok, true);
      assert.deepEqual(report.userResult, baseline.userResult);
      assert.ok(report.metadata.classicalAbjadShadow);
      assert.equal(report.metadata.classicalAbjadShadow.compare.total, 92);
    } finally {
      console.info = origInfo;
    }
  });
  console.log('B2. shadow log exception isolation: ok');
}

// ─── C. FAB-010b mother letterCount=9 ────────────────────────────────
{
  const fx010b = data.fixtures.find((f) => f.id === 'FAB-010b');
  assert.ok(fx010b);
  const result = runClassicalAbjad({
    includeMotherName: true,
    parts: fx010b.parts.map((p) => ({
      type: p.type,
      selectedSpelling: p.selectedSpelling,
      confirmed: true,
    })),
  });
  assert.equal(result.combinedTotal, 227);
  assert.equal(result.total, 227);
  const summary = buildClassicalShadowSummary(result, { productionAlifMaddaValue: 1 });
  assert.equal(summary.total, 227);
  assert.equal(summary.combinedTotal, 227);
  assert.equal(summary.letterCount, 9);
  assert.equal(summary.includeMotherName, true);
  assertNoShadowPii(summary);

  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'true' }, () => {
    const report = buildSymbolicAnalysis({
      input: {
        name: 'Muhammed',
        birthDate: '1990-01-01',
        intention: 'test',
        selectedSpelling: 'محمد',
        spellingConfirmed: true,
        includeMotherName: true,
        motherNameSelectedSpelling: 'فاطمة',
        motherSpellingConfirmed: true,
        consents,
      },
      layers: ['ebced'],
    });
    const cmp = report.metadata.classicalAbjadShadow.compare;
    assert.equal(cmp.total, 227);
    assert.equal(cmp.combinedTotal, 227);
    assert.equal(cmp.letterCount, 9);
    assertNoShadowPii(report.metadata.classicalAbjadShadow);
  });
  console.log('C. FAB-010b shadow letterCount=9: ok');
}

// ─── D. includeMotherName=false → mother letters excluded ────────────
{
  const result = runClassicalAbjad({
    includeMotherName: false,
    parts: [
      { type: 'primary', selectedSpelling: 'محمد', confirmed: true },
      { type: 'motherName', selectedSpelling: 'فاطمة', confirmed: true },
    ],
  });
  assert.equal(result.parts.length, 1);
  assert.equal(result.combinedTotal, null);
  assert.equal(result.total, 92);
  const summary = buildClassicalShadowSummary(result);
  assert.equal(summary.letterCount, 4);
  assert.equal(summary.includeMotherName, false);
  console.log('D. includeMotherName=false letterCount: ok');
}

// ─── E. Flag OFF — no shadow metadata ────────────────────────────────
{
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'false', ATLAS_CLASSICAL_ABJAD_SHADOW: 'true' }, () => {
    assert.equal(getClassicalAbjadFlagMode(), 'off');
    assert.equal(isClassicalAbjadShadowEnabled(), false);
    const report = buildSymbolicAnalysis({
      input: {
        name: 'Lara',
        birthDate: '1990-05-12',
        intention: 'test',
        selectedSpelling: 'محمد',
        spellingConfirmed: true,
        consents,
      },
      layers: ['ebced'],
    });
    assert.equal(report.metadata.classicalAbjadShadow, undefined);
    assert.equal(report.ok, true);
    assert.ok(report.userResult.sections.length >= 1);
  });
  console.log('E. flag OFF no shadow metadata: ok');
}

// ─── F. Shadow error metadata PII scrub ──────────────────────────────
{
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'true' }, () => {
    __setClassicalAbjadShadowTestHooks({
      runClassicalAbjad: () => {
        const err = new Error('boom');
        err.stack = 'Error: boom\n    at selectedSpelling fullName motherName letters';
        throw err;
      },
    });
    try {
      const report = buildSymbolicAnalysis({
        input: {
          name: 'Jean-Luc',
          fullName: 'Jean-Luc',
          birthDate: '1990-01-01',
          intention: 'test',
          selectedSpelling: 'علي',
          spellingConfirmed: true,
          motherName: 'Marie',
          consents,
        },
        layers: ['ebced'],
      });
      const shadow = report.metadata.classicalAbjadShadow;
      assert.equal(shadow.compare.status, 'error');
      assertNoShadowPii(shadow);
      assert.equal('stack' in shadow.compare, false);
      assert.equal('message' in shadow.compare, false);
      assert.equal('selectedSpelling' in shadow.compare, false);
    } finally {
      __setClassicalAbjadShadowTestHooks(null);
    }
  });
  console.log('F. shadow error metadata PII scrub: ok');
}

// ─── Optional: env trim + lowercase (`True`, ` true `) ───────────────
{
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'True' }, () => {
    assert.equal(getClassicalAbjadFlagMode(), 'on');
    assert.equal(isClassicalAbjadShadowEnabled(), true);
  });
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: ' true ' }, () => {
    assert.equal(getClassicalAbjadFlagMode(), 'on');
    assert.equal(isClassicalAbjadShadowEnabled(), true);
  });
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'TRUE' }, () => {
    assert.equal(getClassicalAbjadFlagMode(), 'on');
  });
  withEnv({ ATLAS_CLASSICAL_ABJAD_V1: 'nope' }, () => {
    assert.equal(getClassicalAbjadFlagMode(), 'off');
  });
  console.log('env flag trim/lowercase: ok');
}

// ─── Malformed parts must not throw in letterCount ───────────────────
{
  assert.doesNotThrow(() => {
    const n = buildClassicalShadowSummary({
      letters: [],
      includeMotherName: true,
      parts: [null, { letters: null }, { letters: [{}, {}] }, 'bad'],
      total: 0,
      status: 'complete',
      methodologyId: CLASSICAL_ABJAD_METHODOLOGY.methodologyId,
      rulesetVersion: CLASSICAL_ABJAD_METHODOLOGY.rulesetVersion,
    });
    assert.equal(n.letterCount, 2);
  });
  console.log('malformed parts letterCount safe: ok');
}

console.log('\nPASS classical-abjad faz3');

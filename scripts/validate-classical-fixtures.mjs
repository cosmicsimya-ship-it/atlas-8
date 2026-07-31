import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('tests/fixtures/classical-abjad-fixtures.json', 'utf8'));
const errors = [];
const info = [];

function sumLetters(letters) {
  return (letters || []).reduce((s, l) => s + Number(l.value || 0), 0);
}

if (data.rulesetVersion !== 'classical-kabir-rules-1.0.0') {
  errors.push(`rulesetVersion expected classical-kabir-rules-1.0.0 got ${data.rulesetVersion}`);
}
if (data.methodologyId !== 'abjad-kabir-classical-v1') {
  errors.push(`methodologyId mismatch ${data.methodologyId}`);
}
if (data.methodologyVersion !== '1.0.0') {
  errors.push(`methodologyVersion mismatch`);
}
if (data.rulesetVersion == null) errors.push('rulesetVersion is null');

if (!data.optionalDigitReductionPolicy || data.optionalDigitReductionPolicy.enabledForClassicalPrimary !== false) {
  errors.push('digit reduction must be disabled for classical primary');
}

const ids = data.fixtures.map((f) => f.id);
info.push(`fixtureCount=${data.fixtures.length}`);
info.push(`ids=${ids.join(',')}`);
if (ids.includes('FAB-012')) errors.push('unexpected FAB-012 id present');
for (const need of ['FAB-003', 'FAB-012a', 'FAB-012b', 'FAB-CONFLICT-AA', 'FAB-010a', 'FAB-010b', 'FAB-013']) {
  if (!ids.includes(need)) errors.push(`missing ${need}`);
}

let numeric = 0;
for (const fx of data.fixtures) {
  if (Array.isArray(fx.parts) && fx.parts.length) {
    for (const part of fx.parts) {
      const s = sumLetters(part.letters);
      if (s !== part.subtotal) {
        errors.push(`${fx.id} part ${part.type} sum ${s} !== subtotal ${part.subtotal}`);
      }
    }
    if (fx.includeMotherName === true) {
      const combined = fx.parts.reduce((s, p) => s + p.subtotal, 0);
      if (fx.combinedTotal !== combined) {
        errors.push(`${fx.id} combinedTotal ${fx.combinedTotal} !== ${combined}`);
      }
      if (fx.inputArabic != null && fx.inputArabic !== '') {
        // allow only if explicitly documented; 010b should be null
        if (fx.id === 'FAB-010b') errors.push('FAB-010b must not use merged inputArabic string');
      }
    } else if (fx.includeMotherName === false && fx.combinedTotal != null) {
      errors.push(`${fx.id} combinedTotal must be null when includeMotherName=false`);
    }
    if (typeof fx.expectedTotal === 'number') numeric += 1;
    continue;
  }

  if (typeof fx.expectedTotal === 'number') {
    numeric += 1;
    if ((fx.letters || []).length === 0 && fx.expectedTotal !== 0) {
      // zero-letter numeric only ok for empty? FAB-006 has letter
      if (fx.expectedTotal !== 0) {
        // still check sum
      }
    }
    const s = sumLetters(fx.letters);
    if (s !== fx.expectedTotal) {
      errors.push(`${fx.id} sum ${s} !== expectedTotal ${fx.expectedTotal}`);
    }
  } else {
    if (!fx.expectError && fx.status !== 'blocked_pending_ruleset_approval') {
      // informational ok
    }
    if ((fx.unsupportedCharacters && fx.unsupportedCharacters.length) || fx.expectError) {
      if (typeof fx.expectedTotal === 'number' && (fx.letters || []).length === 0) {
        errors.push(`${fx.id} unsupported/error fixture must not silently have numeric total without letters`);
      }
    }
  }
}

info.push(`numericFixtures=${numeric}`);
if (numeric !== 24) {
  errors.push(`expected 24 numeric fixtures, got ${numeric}`);
}

// unsupported must not look like success totals without letters
for (const fx of data.fixtures.filter((f) => f.category === 'unsupported_character')) {
  if (!fx.expectError) errors.push(`${fx.id} missing expectError`);
  if ((fx.letters || []).length > 0 && fx.unsupportedCharacters?.length) {
    info.push(`${fx.id} has letters despite unsupported — review`);
  }
}

console.log(info.join('\n'));
if (errors.length) {
  console.error('FAIL');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('PASS');

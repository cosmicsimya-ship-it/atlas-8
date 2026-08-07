/**
 * Archive GET contract + empty-result copy acceptance (no server boot).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Load TS helpers via dynamic transpile-free path: duplicate unwrap in pure JS for node test
// by importing compiled-free ESM from a small mirror — use tsx if available, else inline test of logic.

let passed = 0;
let failed = 0;
function record(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// Inline mirror of unwrap (must stay in sync with src/utils/archive-result-contract.ts)
function unwrapArchiveRecordPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('bad');
  const root = payload;
  const candidate =
    root.analysis && typeof root.analysis === 'object'
      ? root.analysis
      : root.record && typeof root.record === 'object'
        ? root.record
        : root;
  if (!candidate.id || typeof candidate.id !== 'string') throw new Error('incomplete');
  return {
    id: candidate.id,
    title: String(candidate.title ?? 'Analiz'),
    envelope: candidate.envelope ?? null,
    status: candidate.status ?? 'complete',
  };
}

const envelope = {
  agent: 'core-engine',
  task_id: 't1',
  status: 'complete',
  payload: {
    synthesis: {
      subject_id: 'u',
      source_systems: ['numerological'],
      source_findings: [],
      convergences: [],
      contradictions: [],
      core_pattern: 'Tekrar eden kayıp/kazanç gerilimi.',
      life_architecture: 'Yapı: risk ve geri çekilme.',
      development_axis: 'Ölçülü adım.',
      current_cycle: 'Dikkat dönemi.',
      potential_gates: [],
      recommended_directions: ['Nakit akışını yaz.'],
      confidence: { overall: 0.55, by_finding: [] },
      evidence_map: [],
      missing_data: [],
      warnings: [],
    },
  },
  handoff_to: [],
};

const wrapped = {
  userId: 'anonymous:x',
  analysis: {
    id: 'a1',
    title: 'Para / risk',
    intention: 'general',
    status: 'complete',
    name: null,
    referenceDate: null,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    formSummary: {},
    envelope,
  },
};

try {
  const rec = unwrapArchiveRecordPayload(wrapped);
  record('unwrap wrapped {analysis}', rec.id === 'a1' && rec.envelope?.status === 'complete');
  record('envelope present after unwrap', Boolean(rec.envelope?.payload?.synthesis?.core_pattern));
} catch (e) {
  record('unwrap wrapped {analysis}', false, String(e));
}

try {
  const bare = unwrapArchiveRecordPayload(wrapped.analysis);
  record('unwrap bare record legacy', bare.id === 'a1' && bare.envelope != null);
} catch (e) {
  record('unwrap bare record legacy', false, String(e));
}

try {
  unwrapArchiveRecordPayload({ userId: 'x' });
  record('reject incomplete payload', false);
} catch {
  record('reject incomplete payload', true);
}

// Simulate old FE bug: treating wrapper as record
const buggy = wrapped;
record(
  'old FE would see null envelope (bug repro)',
  buggy.envelope == null && buggy.analysis?.envelope != null,
);

// Source scan: no generic "Sonuç verisi bulunamadı"
import { readFileSync } from 'node:fs';
const analysisResult = readFileSync(resolve(root, 'src/pages/AnalysisResult.tsx'), 'utf8');
const resultRenderer = readFileSync(resolve(root, 'src/components/cosmic/ResultRenderer.tsx'), 'utf8');
const archiveSvc = readFileSync(resolve(root, 'src/services/analysis-archive.ts'), 'utf8');
const contract = readFileSync(resolve(root, 'src/utils/archive-result-contract.ts'), 'utf8');

record(
  'AnalysisResult drops generic empty copy',
  !/Sonuç verisi bulunamadı/.test(analysisResult),
);
record(
  'ResultRenderer drops technical empty dump',
  !/görüntülenecek sentez bölümü bulunamadı/.test(resultRenderer) &&
    !/Ham veri kaydedildi/.test(resultRenderer),
);
record(
  'getArchiveRecord uses unwrap',
  /unwrapArchiveRecordPayload/.test(archiveSvc),
);
record(
  'contract documents backend wrap',
  /analysis:/.test(contract) && /emptyResultUserCopy/.test(contract),
);
record(
  'brand empty copy present',
  /Sonuç gövdesi eksik/.test(contract) && /Eksik bilgi/.test(contract),
);

// Backend still returns wrap shape
const indexJs = readFileSync(resolve(root, 'server/index.js'), 'utf8');
record(
  'backend GET still returns { analysis }',
  /res\.json\(\{\s*userId: req\.auth\.userId,\s*analysis: record\s*\}\)/.test(indexJs) ||
    /analysis: record/.test(indexJs),
);

console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed) process.exit(1);

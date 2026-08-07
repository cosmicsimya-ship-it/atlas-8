/**
 * Cognitive Reflex P1/P2 regression matrix (deterministic where possible).
 * Run: node scripts/test-cognitive-reflex.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyNarrowReflexPostGuard,
  buildEvidenceSet,
  buildReflexStateFromSynthesis,
  detectAnalyticStance,
  isCasualReflexBypass,
  mapHypothesisBand,
  resolveAdvanceAllowed,
  resolveCreativeProvenance,
} from '../server/cognitive-reflex-guards.js';
import {
  detectConversationIntent,
  tryDeterministicConversationReply,
  containsForbiddenCasualPhrase,
} from '../server/atlas-conversation-style.js';
import { detectCrossLayerSynthesisIntent } from '../server/cross-layer-synthesis/message-integration.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
const rows = [];

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function record(scenario, expectedReflex, actual, ok) {
  rows.push({
    scenario,
    expectedReflex,
    actualBehavior: actual,
    pass: ok,
  });
  if (ok) {
    passed += 1;
    console.log(`✓ ${scenario}`);
  } else {
    failed += 1;
    console.error(`✗ ${scenario} — ${actual}`);
  }
}

// ── P1 prompt surface ────────────────────────────────────────────────
const style = read('server/atlas_response_style.md');
const forbidden = read('server/atlas_forbidden_patterns.md');
const reasoning = read('server/atlas_reasoning.md');
const decision = read('server/atlas_decision.md');

record(
  'P1 no R1–R12 dump',
  'short principles',
  'checked',
  !/R1\b.*R12\b|R1 Cevabı|R5 Tek sinyal/.test(style + reasoning + decision + forbidden) &&
    /Internal cognition|Süreç Anlatımı|Analizde ölçülü/.test(style + forbidden + reasoning),
);

record(
  'P1 process narration ban',
  'forbid staged method',
  'present',
  /Önce ayıklıyorum/.test(style) && /Süreç Anlatımı/.test(forbidden),
);

record(
  'P1 enough≠proof',
  'hypothesis permission language',
  'present',
  /Enough data permits a hypothesis|Yeterli veri hipoteze izin|kanıtlandı demek değildir/.test(
    style + reasoning + decision,
  ),
);

// ── 1–3 Basit sohbet ─────────────────────────────────────────────────
for (const [msg, intent] of [
  ['Merhaba', 'greeting'],
  ['Teşekkürler', 'thanks'],
  ['Bugün nasılsın?', 'how_are_you'],
]) {
  const det = tryDeterministicConversationReply({
    message: msg,
    userId: 'web:reflex-test',
    founderSession: false,
  });
  const stance = detectAnalyticStance(msg, { conversationIntent: intent });
  const forbiddenHit = containsForbiddenCasualPhrase(det?.reply || '', intent);
  record(
    msg,
    'casual bypass; no analytic stance',
    `intent=${detectConversationIntent(msg)} stance=${stance} reply=${JSON.stringify(det?.reply)}`,
    detectConversationIntent(msg) === intent &&
      isCasualReflexBypass(intent) &&
      stance === null &&
      Boolean(det?.reply) &&
      forbiddenHit.length === 0 &&
      !/işaret görüyorum|Hipotezim|ayıklıyorum/i.test(det.reply || ''),
  );
}

// ── Stance (conservative) ────────────────────────────────────────────
record(
  'Onay arayışı',
  'stance=approval_seek',
  String(detectAnalyticStance('Sence haklı mıyım bu konuda gerçekten?', { conversationIntent: 'other' })),
  detectAnalyticStance('Sence haklı mıyım bu konuda gerçekten?', { conversationIntent: 'other' }) ===
    'approval_seek',
);

record(
  'Korkuyla soru',
  'stance=fear',
  String(detectAnalyticStance('Gerçekten korkuyorum, kötü mü olacak her şey?', { conversationIntent: 'other' })),
  detectAnalyticStance('Gerçekten korkuyorum, kötü mü olacak her şey?', { conversationIntent: 'other' }) ===
    'fear',
);

record(
  'Kesin sonuç / karar talebi',
  'stance=decide_for_me',
  String(detectAnalyticStance('Ne yapmalıyım, sen karar ver artık.', { conversationIntent: 'other' })),
  detectAnalyticStance('Ne yapmalıyım, sen karar ver artık.', { conversationIntent: 'other' }) ===
    'decide_for_me',
);

record(
  'Belirsiz → stance null (no false analysis)',
  'stance=null',
  String(detectAnalyticStance('Bugün biraz karışık bir gün.', { conversationIntent: 'other' })),
  detectAnalyticStance('Bugün biraz karışık bir gün.', { conversationIntent: 'other' }) === null,
);

// ── Tek işaret / advance ─────────────────────────────────────────────
record(
  'Tek işaret',
  'advance=false H0',
  `advance=${resolveAdvanceAllowed({ usableLayerCount: 1, relationshipType: 'supporting', confidence: 'medium' })} band=${mapHypothesisBand({ usableLayerCount: 1, relationshipType: 'supporting', confidence: 'medium', advanceAllowed: false })}`,
  resolveAdvanceAllowed({
    usableLayerCount: 1,
    relationshipType: 'supporting',
    confidence: 'medium',
  }) === false &&
    mapHypothesisBand({
      usableLayerCount: 1,
      relationshipType: 'supporting',
      confidence: 'medium',
      advanceAllowed: false,
    }) === 'H0',
);

// ── İki bağımsız ─────────────────────────────────────────────────────
record(
  'İki bağımsız işaret',
  'advance ok, H1',
  `advance=${resolveAdvanceAllowed({ usableLayerCount: 2, relationshipType: 'independent', confidence: 'low' })} band=${mapHypothesisBand({ usableLayerCount: 2, relationshipType: 'independent', confidence: 'low', advanceAllowed: true })}`,
  resolveAdvanceAllowed({
    usableLayerCount: 2,
    relationshipType: 'independent',
    confidence: 'low',
  }) === true &&
    mapHypothesisBand({
      usableLayerCount: 2,
      relationshipType: 'independent',
      confidence: 'low',
      advanceAllowed: true,
    }) === 'H1',
);

// ── Çelişkili ────────────────────────────────────────────────────────
record(
  'Çelişkili iki işaret',
  'advance ok, H2 hold tension',
  mapHypothesisBand({
    usableLayerCount: 2,
    relationshipType: 'contradictory',
    confidence: 'medium',
    advanceAllowed: true,
  }),
  mapHypothesisBand({
    usableLayerCount: 2,
    relationshipType: 'contradictory',
    confidence: 'medium',
    advanceAllowed: true,
  }) === 'H2',
);

// ── Eksik bilgi ──────────────────────────────────────────────────────
record(
  'Eksik bilgi',
  'H0 / advance false',
  mapHypothesisBand({
    usableLayerCount: 2,
    relationshipType: 'insufficient_data',
    confidence: 'insufficient',
    advanceAllowed: false,
  }),
  resolveAdvanceAllowed({
    usableLayerCount: 2,
    relationshipType: 'insufficient_data',
    confidence: 'insufficient',
  }) === false &&
    mapHypothesisBand({
      usableLayerCount: 2,
      relationshipType: 'insufficient_data',
      confidence: 'insufficient',
      advanceAllowed: false,
    }) === 'H0',
);

// ── Yeterli veri ─────────────────────────────────────────────────────
record(
  'Yeterli veri',
  'advance=true; still not proof',
  'advance permits hypothesis only',
  resolveAdvanceAllowed({
    usableLayerCount: 3,
    relationshipType: 'supporting',
    confidence: 'medium',
  }) === true &&
    mapHypothesisBand({
      usableLayerCount: 3,
      relationshipType: 'supporting',
      confidence: 'medium',
      advanceAllowed: true,
    }) === 'H3',
);

// ── Creative mümkün / değil ──────────────────────────────────────────
const synthOk = {
  confidence: 'medium',
  primaryRelationship: {
    type: 'supporting',
    layerAId: 'astrology',
    layerBId: 'numerology',
  },
  sections: {
    sourceSummaries: [{ layerId: 'astrology' }, { layerId: 'numerology' }],
  },
};
const evidenceOk = buildEvidenceSet(synthOk, '');
const creativeOk = resolveCreativeProvenance(synthOk, evidenceOk);
record(
  'Creative mümkün',
  'A,B in EvidenceSet',
  JSON.stringify(creativeOk.provenance),
  creativeOk.allowed === true &&
    creativeOk.provenance?.aRef === 'layer:astrology' &&
    creativeOk.provenance?.bRef === 'layer:numerology',
);

const synthBad = {
  confidence: 'medium',
  primaryRelationship: {
    type: 'supporting',
    layerAId: 'astrology',
    layerBId: 'dream',
  },
  sections: {
    sourceSummaries: [{ layerId: 'astrology' }],
  },
};
const evidenceBad = buildEvidenceSet(synthBad, '');
const creativeBad = resolveCreativeProvenance(synthBad, evidenceBad);
record(
  'Creative mümkün değil',
  'B unresolved → deny',
  creativeBad.reason,
  creativeBad.allowed === false,
);

const reflexFromSynth = buildReflexStateFromSynthesis(synthOk, {
  usableLayerCount: 2,
  message: '',
});
record(
  'Reflex state from CLS',
  'advance+creative attached',
  `advance=${reflexFromSynth.advanceAllowed} creative=${reflexFromSynth.creativeAllowed} band=${reflexFromSynth.hypothesisBand}`,
  reflexFromSynth.advanceAllowed === true && reflexFromSynth.creativeAllowed === true,
);

// ── Post-guard ───────────────────────────────────────────────────────
const narr = applyNarrowReflexPostGuard(
  'Önce ayıklıyorum… Sonra asıl konuya geliyorum. Tekrar eden bir döngü var.',
  { casual: false },
);
record(
  'Process narration stripped',
  'no staged opener',
  narr.reply.slice(0, 80),
  narr.hits.includes('process_narration') && !/^Önce ayıklıyorum/i.test(narr.reply),
);

const proof = applyNarrowReflexPostGuard('Bu okuma kanıtlandı ve kesin sonuç budur.', {
  casual: false,
  advanceAllowed: true,
});
record(
  'Advance ≠ proof language',
  'soften proof claims',
  proof.reply,
  proof.hits.includes('advance_as_proof') && !/kanıtlandı|kesin sonuç/i.test(proof.reply),
);

const steal = applyNarrowReflexPostGuard('Kaderin bu. Bunu yapmak zorundasın.', {
  casual: false,
  stance: 'decide_for_me',
});
record(
  'Kullanıcı itirazı / karar gaspı',
  'decision stealing softened',
  steal.reply,
  steal.hits.includes('decision_stealing') && !/kaderin bu|yapmak zorundasın/i.test(steal.reply),
);

const casualGuard = applyNarrowReflexPostGuard('Merhaba.', { casual: true });
record(
  'Casual post-guard no-op',
  'unchanged',
  casualGuard.reply,
  casualGuard.changed === false && casualGuard.reply === 'Merhaba.',
);

// ── Cross-layer intent still detects multi-layer ─────────────────────
const clsIntent = detectCrossLayerSynthesisIntent(
  'Doğum haritamdaki Satürn ile bugünkü sayımı birlikte oku, sentez istiyorum.',
);
record(
  'Cross-layer',
  'wantsSynthesis',
  JSON.stringify({ wants: clsIntent.wantsSynthesis, layers: clsIntent.layersRequested }),
  clsIntent.wantsSynthesis === true && (clsIntent.layersRequested?.length ?? 0) >= 1,
);

// ── Engine surfaces still honest (file-level) ────────────────────────
const dream = read('server/dream-engine/depth-guard.js') + read('server/dream-flow.js');
const tarot = read('server/tarot-engine/depth-guard.js') + read('server/tarot-flow.js');
const num =
  read('server/numerology-engine/depth-guard.js') + read('server/numerology-flow.js');

record(
  'Dream',
  'single-symbol / uncertainty remain',
  'depth-guard present',
  /no_single_symbol|uncertainty|Tek sembol/i.test(dream),
);
record(
  'Tarot',
  'uncertainty boundary remain',
  'depth-guard present',
  /uncertainty_boundary|hasUncertaintyBoundary/.test(tarot),
);
record(
  'Numerology',
  'not only single number',
  'depth-guard present',
  /not_only_single_number|Tek sayı/i.test(num),
);

// Prefer convergence still in message-service
const msgSvc = read('server/atlas-message-service.js');
record(
  'preferConvergence + reflex wiring',
  'P2 hooks present',
  'wired',
  /preferConvergence/.test(msgSvc) &&
    /detectAnalyticStance/.test(msgSvc) &&
    /applyNarrowReflexPostGuard/.test(msgSvc) &&
    !/Cognitive Reflex Engine/.test(msgSvc),
);

console.log('\n=== MATRIX ===');
for (const r of rows) {
  console.log(
    `${r.pass ? 'PASS' : 'FAIL'}\t${r.scenario}\t| ${r.expectedReflex}\t| ${String(r.actualBehavior).slice(0, 100)}`,
  );
}
console.log(`\n=== ${passed}/${passed + failed} passed ===`);
if (failed > 0) process.exit(1);

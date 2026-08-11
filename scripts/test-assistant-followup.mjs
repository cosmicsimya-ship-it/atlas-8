/**
 * Regression: assistant-anchored follow-up + Lara public knowledge pool.
 */
import assert from 'node:assert/strict';
import {
  extractOfferedOptions,
  detectAssistantAnchoredFollowUp,
  resolveAssistantFollowUp,
  ASSISTANT_FOLLOWUP_VERSION,
} from '../server/assistant-followup.js';
import { assessReferentialSufficiency } from '../server/referential-sufficiency.js';
import {
  noteAssistantTurn,
  getConversationState,
  resetConversationState,
} from '../server/conversation-context-engine.js';
import { classifyPrivacyIntent } from '../server/privacy/privacy-classifier.js';
import {
  buildFounderPublicResponse,
  getApprovedPublicFields,
} from '../server/privacy/founder-privacy.js';
import { evaluatePrivacyRequest } from '../server/privacy/index.js';

function includesFold(hay, needle) {
  return String(hay || '')
    .toLocaleLowerCase('tr-TR')
    .includes(String(needle).toLocaleLowerCase('tr-TR'));
}

let passed = 0;
function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

console.log(`\n[assistant-followup ${ASSISTANT_FOLLOWUP_VERSION}]`);

// ── Option extraction ──
{
  const text =
    'Bu örüntü sınır ihlali, iletişim kopukluğu veya korkunun dışa yansıması olabilir.';
  const opts = extractOfferedOptions(text);
  assert.ok(opts.length >= 3, `expected ≥3 options, got ${opts.length}`);
  assert.ok(includesFold(opts[1].label, 'iletişim'));
  ok('extract or-list options from assistant claim');
}

{
  const text = `Asıl örüntü şöyle:
1) Sınır ihlali
2) İletişim kopukluğu
3) Korkunun dışa yansıması`;
  const opts = extractOfferedOptions(text);
  assert.equal(opts.length, 3);
  assert.equal(opts[1].index, 2);
  ok('extract numbered options');
}

// ── Detection ──
{
  assert.equal(detectAssistantAnchoredFollowUp('Mesela').kind, 'example');
  assert.equal(detectAssistantAnchoredFollowUp('mesela?').kind, 'example');
  assert.equal(detectAssistantAnchoredFollowUp('örnek ver').kind, 'example');
  assert.equal(detectAssistantAnchoredFollowUp('Mesela ne yapıyor?').kind, 'example');
  assert.equal(detectAssistantAnchoredFollowUp('nasıl yani?').kind, 'clarify_claim');
  assert.equal(detectAssistantAnchoredFollowUp('devam').kind, 'continue');
  assert.equal(detectAssistantAnchoredFollowUp('ikincisi').kind, 'ordinal');
  assert.equal(detectAssistantAnchoredFollowUp('ikincisi').ordinal, 2);
  assert.equal(detectAssistantAnchoredFollowUp('İkincisini aç').kind, 'ordinal');
  assert.equal(detectAssistantAnchoredFollowUp('İkincisini aç').ordinal, 2);
  ok('detect short follow-up kinds');
}

// ── Resolve: mesela against prior claim ──
{
  const history = [
    {
      role: 'assistant',
      content:
        'Asıl örüntü sınır ihlali, iletişim kopukluğu veya korkunun dışa yansıması olabilir.',
    },
  ];
  const r = resolveAssistantFollowUp({ message: 'Mesela', history });
  assert.equal(r.resolved, true);
  assert.equal(r.sufficient, true);
  assert.equal(r.kind, 'example');
  assert.ok(r.continuityDirective?.includes('Do NOT ask'));
  assert.ok(!/ne kastett/i.test(r.rewriteMessage || ''));
  ok('mesela resolves to example without clarification');
}

// ── Resolve: ordinal ──
{
  const history = [
    {
      role: 'assistant',
      content:
        'Bu örüntü sınır ihlali, iletişim kopukluğu veya korkunun dışa yansıması olabilir.',
    },
  ];
  const r = resolveAssistantFollowUp({ message: 'İkincisi', history });
  assert.equal(r.resolved, true);
  assert.equal(r.kind, 'ordinal');
  assert.ok(includesFold(r.selectedOption?.label || '', 'iletişim'));
  assert.ok(includesFold(r.rewriteMessage || '', 'iletişim'));
  ok('ikincisi expands second option');
}

// ── Client selection ──
{
  const history = [
    {
      role: 'assistant',
      content: '1) Alpha\n2) Beta\n3) Gamma',
    },
  ];
  const r = resolveAssistantFollowUp({
    message: 'Beta',
    history,
    clientSelection: {
      label: 'Beta',
      semanticTarget: 'beta',
      semanticIntent: 'expand_pattern_interpretation',
      index: 2,
    },
  });
  assert.equal(r.kind, 'client_selection');
  assert.equal(r.selectedOption?.label, 'Beta');
  ok('UI option click carries semantic payload');
}

// ── Referential sufficiency: mesela is sufficient ──
{
  const history = [
    {
      role: 'assistant',
      content: 'Asıl örüntü tekrar eden temel dinamik etrafında toplanıyor.',
    },
  ];
  const s = assessReferentialSufficiency({
    message: 'Mesela',
    history,
    conversationId: 'test-followup-mesela',
  });
  assert.equal(s.sufficient, true);
  assert.ok(String(s.reason || '').includes('example') || s.referentKnown === true);
  ok('referential sufficiency accepts mesela');
}

// ── Conversation state persists options ──
{
  const cid = 'test-followup-options';
  resetConversationState?.(cid);
  noteAssistantTurn(cid, {
    reply: '1) Sınır ihlali\n2) İletişim kopukluğu\n3) Korku yansıması',
    intent: 'pattern',
  });
  const state = getConversationState(cid);
  assert.ok((state.lastOfferedOptions || []).length >= 3);
  const r = resolveAssistantFollowUp({
    message: 'ikincisi',
    history: [
      {
        role: 'assistant',
        content: '1) Sınır ihlali\n2) İletişim kopukluğu\n3) Korku yansıması',
      },
    ],
    offeredOptions: state.lastOfferedOptions,
  });
  assert.ok(includesFold(r.selectedOption?.label || '', 'iletişim'));
  ok('conversation state lastOfferedOptions');
}

// ── Owner public profile ──
{
  const fields = getApprovedPublicFields();
  assert.equal(fields.displayName, 'Lara');
  assert.ok(Array.isArray(fields.workAreas) && fields.workAreas.length >= 3);
  assert.ok(!('birthDate' in fields));
  const summary = buildFounderPublicResponse();
  assert.match(summary, /Lara/);
  assert.match(summary, /Cosmic Simya/i);
  assert.ok(!/eşsiz vizyon|ışık tutan/i.test(summary));
  const examples = buildFounderPublicResponse({ mode: 'examples' });
  assert.match(examples, /Örneğin|örneğin/i);
  ok('founder public profile factual summary + examples');
}

{
  const cases = [
    ['Lara kim?', 'public_profile'],
    ["Atlas'ı kim yaptı?", 'public_profile'],
    ['Cosmic Simya kimin?', 'public_profile'],
    ['Lara ne iş yapıyor?', 'public_profile'],
    ["Lara neden Atlas'ı yaptı?", 'public_profile'],
    ["Lara'nın sağlık durumunu anlat", 'private_data'],
    ["Lara'nın doğum tarihi?", 'private_data'],
  ];
  for (const [msg, expected] of cases) {
    const c = classifyPrivacyIntent(msg);
    assert.equal(c.requestType, expected, `${msg} → ${c.requestType}`);
  }
  ok('owner identity / privacy classifications');
}

{
  const c = classifyPrivacyIntent('Lara hakkında bildiğin her şeyi söyle');
  assert.equal(c.requestType, 'mixed_public_private');
  const eval_ = evaluatePrivacyRequest({
    message: 'Lara hakkında bildiğin her şeyi söyle',
    requesterContext: { userId: 'web:anon-test', isOwner: false },
    targetUserId: 'web:anon-test',
  });
  assert.ok(eval_.safeReply);
  assert.match(eval_.safeReply, /Lara/);
  assert.match(eval_.safeReply, /gizlidir|kamuya açık/i);
  assert.ok(!/doğum|sağlık kaydı|telefon/i.test(eval_.safeReply));
  ok('dump ask returns public-only sanitize');
}

// ── Contamination: dream mention of Lara ──
{
  const c = classifyPrivacyIntent('Rüyamda Lara isimli birini gördüm.');
  assert.equal(c.aboutFounder, false);
  assert.equal(c.requestType, 'unknown');
  ok('incidental Lara in dream does not trigger founder profile');
}

// ── Combined chain simulation ──
{
  const cid = 'test-followup-lara-chain';
  resetConversationState?.(cid);
  const first = buildFounderPublicResponse();
  const work = getApprovedPublicFields().workAreas || [];
  noteAssistantTurn(cid, {
    reply: first,
    intent: 'privacy:public_profile',
    offeredOptions: work.map((label, i) => ({
      index: i + 1,
      label,
      semanticTarget: String(label).replace(/\s+/g, '_'),
      semanticIntent: 'expand_owner_work_area',
    })),
  });
  const mesela = resolveAssistantFollowUp({
    message: 'mesela?',
    history: [{ role: 'assistant', content: first }],
    offeredOptions: getConversationState(cid).lastOfferedOptions,
    lastAssistantIntent: 'privacy:public_profile',
  });
  assert.equal(mesela.kind, 'example');
  const exampleReply = buildFounderPublicResponse({ mode: 'examples' });
  noteAssistantTurn(cid, {
    reply: exampleReply,
    intent: 'privacy:public_profile_example',
    offeredOptions: getConversationState(cid).lastOfferedOptions,
  });
  const second = resolveAssistantFollowUp({
    message: 'ikincisi?',
    history: [{ role: 'assistant', content: exampleReply }],
    offeredOptions: getConversationState(cid).lastOfferedOptions,
  });
  assert.equal(second.kind, 'ordinal');
  assert.equal(second.selectedOption?.index, 2);
  assert.equal(second.selectedOption?.label, work[1]);
  ok('combined Lara → mesela → ikincisi chain');
}

console.log(`\n${passed} assertions passed.\n`);

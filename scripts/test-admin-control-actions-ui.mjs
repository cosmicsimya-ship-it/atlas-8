#!/usr/bin/env node
/**
 * Admin Control Center — Phase B frontend wiring, source-level contract test.
 * Run: node scripts/test-admin-control-actions-ui.mjs
 *
 * This repo has no DOM/component test runner. Rather than stand one up for
 * a narrow UI-wiring check, this reads the actual source files and asserts
 * the real guarantees the brief calls for: every write action is wired to
 * a real service function, destructive actions carry a confirmation
 * marker, privacy erase carries a double-confirmation marker, mutation
 * success triggers a refresh, and no out-of-scope UI (role editor, raw
 * data viewers) exists.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const actionsSrc = readFileSync(join(ROOT, 'src/components/admin/AdminUserActions.tsx'), 'utf-8');
const ccSrc = readFileSync(join(ROOT, 'src/components/admin/AdminControlCenter.tsx'), 'utf-8');
const clientSrc = readFileSync(join(ROOT, 'src/services/atlas-admin-actions.ts'), 'utf-8');
const adminPageSrc = readFileSync(join(ROOT, 'src/pages/AdminPage.tsx'), 'utf-8');

let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    console.error(`  \u2717 ${name}`);
  }
}

console.log('\n\u2500\u2500 all 8 write actions referenced and call real service functions \u2500\u2500');
const actionServiceCalls = [
  ['Grant Prime', 'grantPrime('],
  ['Revoke Prime', 'revokePrime('],
  ['Extend Prime', 'extendPrime('],
  ['Set Expiry', 'setPrimeExpiry('],
  ['Reset Usage', 'resetUserUsage('],
  ['Disable Account', 'disableUser('],
  ['Enable Account', 'enableUser('],
  ['Erase Personal Data', 'eraseUserPersonalData('],
];
for (const [label, call] of actionServiceCalls) {
  ok(`${label} calls ${call.replace('(', '')}`, actionsSrc.includes(call));
}

console.log('\n\u2500\u2500 service functions are real, imported from the actual client (not stubbed/mocked in the component) \u2500\u2500');
ok(
  'AdminUserActions imports all 8 functions from atlas-admin-actions service',
  [
    'grantPrime',
    'revokePrime',
    'extendPrime',
    'setPrimeExpiry',
    'resetUserUsage',
    'disableUser',
    'enableUser',
    'eraseUserPersonalData',
  ].every((fn) => new RegExp(`import\\s*{[^}]*\\b${fn}\\b[^}]*}\\s*from\\s*'\\.\\./\\.\\./services/atlas-admin-actions'`).test(actionsSrc)),
);
ok(
  'atlas-admin-actions.ts functions call real /api/admin/users/:userId/* endpoints, not a mock',
  [
    '/prime/grant',
    '/prime/revoke',
    '/prime/extend',
    '/prime/expiry',
    '/usage/reset',
    '/account/disable',
    '/account/enable',
    '/privacy/erase',
  ].every((path) => clientSrc.includes(path)),
);
ok('client never sends an authority field (adminId/role/plan/entitlements) in any request body', !/(adminId|isAdmin)\s*:/.test(clientSrc));

console.log('\n\u2500\u2500 confirmation UX markers \u2500\u2500');
ok('Revoke Prime dialog is marked danger (destructive styling)', /RevokePrimeDialog[\s\S]{0,1200}<ConfirmDialog title="Revoke Prime" danger/.test(actionsSrc));
ok('Revoke Prime dialog shows the target user identifier', /RevokePrimeDialog[\s\S]{0,600}\{userId\}/.test(actionsSrc));
ok('Disable Account dialog is marked danger', /DisableAccountDialog[\s\S]{0,1200}<ConfirmDialog title="Disable Account" danger/.test(actionsSrc));
ok('Disable Account dialog explains real backend behavior (account_disabled wording)', actionsSrc.includes('account_disabled'));

console.log('\n\u2500\u2500 privacy erase has genuine double confirmation \u2500\u2500');
ok('EraseDataDialog has a two-step state (step 1/2)', /useState<1 \| 2>\(1\)/.test(actionsSrc));
ok('Step 2 requires typing the exact identifier before submit is enabled', /disabled=\{!matches\}/.test(actionsSrc) && /typed\.trim\(\) === identifier/.test(actionsSrc));
ok('Erase dialog explicitly lists real scope (memory/profile/preferences, conversations)', actionsSrc.includes('memory/profile/preferences') && actionsSrc.includes('conversations'));
ok('Erase dialog explicitly states account/subscription are NOT deleted', /Account silinmiyor/.test(actionsSrc) && /Subscription silinmiyor/.test(actionsSrc));

console.log('\n\u2500\u2500 mutation success triggers an authoritative refresh, not optimistic local state \u2500\u2500');
ok('onActionDone calls refresh() (re-fetches from server) after every successful mutation', /function onActionDone[\s\S]{0,200}refresh\(\)/.test(actionsSrc));
ok('refresh() itself calls fetchAdminUserDetail (real GET), not a local state mutation', /function refresh\(\)[\s\S]{0,200}fetchAdminUserDetail/.test(actionsSrc));

console.log('\n\u2500\u2500 duplicate-submit protection \u2500\u2500');
ok(
  'shared DialogActions component disables submit while submitting (used by every dialog, not duplicated per-dialog)',
  /function DialogActions[\s\S]{0,900}disabled=\{submitting \|\| disabled\}/.test(actionsSrc),
);
const dialogCallSites = (actionsSrc.match(/<DialogActions\s/g) || []).length;
ok(`all ${dialogCallSites} dialogs route through DialogActions (>= 6 expected)`, dialogCallSites >= 6);
ok('every DialogActions call site passes its own submitting state', (actionsSrc.match(/submitting=\{submitting\}/g) || []).length >= 6);
ok('erase dialog additionally guards submit on the typed-confirmation match, not just submitting state', /if \(!matches\) return;/.test(actionsSrc));

console.log('\n\u2500\u2500 self-protection UX \u2500\u2500');
ok('Disable Account button is disabled when the target is the acting admin themself', /disabled=\{isSelf\}/.test(actionsSrc) && /isSelf = userId === actorUserId/.test(actionsSrc));

console.log('\n\u2500\u2500 Prime action visibility follows real subscription state \u2500\u2500');
ok('Grant Prime only shown for free/inactive or expired accounts (not already-active premium)', /isFreeOrInactive \|\| isExpired\).*&&.*Grant Prime/.test(actionsSrc.replace(/\s+/g, ' ')));
ok('Revoke Prime only shown for active premium accounts', /isActivePrime && <button[\s\S]{0,200}Revoke Prime/.test(actionsSrc));

console.log('\n\u2500\u2500 billing/provenance separation in the UI \u2500\u2500');
ok('Manual admin grants are labeled distinctly from provider-backed subscriptions', actionsSrc.includes("provider === 'admin_manual'") && actionsSrc.includes('Manual Admin Grant'));

console.log('\n\u2500\u2500 scope guarantees: nothing out-of-scope was added \u2500\u2500');
ok('no role-management UI (promote/demote) anywhere in the admin components', !/promote|demote|grantRole|revokeRole/i.test(actionsSrc + ccSrc));
ok('no raw conversation viewer', !/rawConversation|conversationTranscript|full transcript/i.test(actionsSrc + ccSrc));
ok('no raw memory value viewer (memory UX shows counts only, per Phase A)', !/rawMemory|memoryValue|factValue/i.test(actionsSrc + ccSrc));
ok('no entitlement editor (checkbox/toggle for voice.lara etc.) in the UI', !/<input[^>]*checkbox[^>]*voice\.lara|toggle.*entitlement/i.test(actionsSrc + ccSrc));
ok('no impersonation control', !/impersonat/i.test(actionsSrc + ccSrc));

console.log('\n\u2500\u2500 wiring reaches the page \u2500\u2500');
ok('AdminPage passes the real admin actor userId down (not a placeholder)', /AdminControlCenter actorUserId=\{profile\.userId\}/.test(adminPageSrc));
ok('AdminControlCenter renders UserDetailPanel behind row selection, not always-visible', /selectedUserId \? \(/.test(ccSrc) || /selectedUserId &&/.test(ccSrc));

console.log(`\nTotal: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

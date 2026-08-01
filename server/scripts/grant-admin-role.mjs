/**
 * Grant the admin role to an existing account by email.
 *
 * Usage:
 *   node server/scripts/grant-admin-role.mjs --email you@example.com
 *
 * Looks up account by email field, or by username when username equals the email.
 * Never accepts or stores plaintext passwords. Role changes are audit-logged.
 * There is no HTTP API for self role escalation — this CLI is server-side only.
 */
import 'dotenv/config';
import {
  configureAccountStore,
  findAccountByEmail,
  grantAccountRole,
  isValidEmailShape,
  getAccountStorePath,
  updateActiveSessionRolesForUser,
  logAdminAudit,
  configureAdminAuditStore,
} from '../auth/index.js';

function parseArgs(argv) {
  const out = { email: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email' || a === '-e') {
      out.email = argv[i + 1] ?? null;
      i += 1;
    } else if (a.startsWith('--email=')) {
      out.email = a.slice('--email='.length);
    } else if (a === '--dry-run') {
      out.dryRun = true;
    }
  }
  return out;
}

const { email, dryRun } = parseArgs(process.argv.slice(2));

if (!email || !isValidEmailShape(email)) {
  console.error('Usage: node server/scripts/grant-admin-role.mjs --email you@example.com');
  console.error('Provide a valid email matching an existing account.');
  process.exit(1);
}

const actor = process.env.ATLAS_ADMIN_GRANT_ACTOR || `cli:${process.env.USER || process.env.USERNAME || 'local'}`;

try {
  const existing = findAccountByEmail(email);
  if (!existing) {
    logAdminAudit({
      action: 'role.grant',
      actor,
      targetEmail: email,
      role: 'admin',
      result: 'error',
      reason: 'account_not_found',
    });
    console.error(`No account found for email: ${email}`);
    console.error('Create/provision the account first, then re-run this command.');
    process.exit(1);
  }

  console.log('Account verified:');
  console.log(`  id:       ${existing.id}`);
  console.log(`  username: ${existing.username}`);
  console.log(`  email:    ${existing.email ?? '(will set from --email)'}`);
  console.log(`  userId:   ${existing.userId}`);
  console.log(`  roles:    ${(existing.roles ?? []).join(', ') || '(none)'}`);
  console.log(`  store:    ${getAccountStorePath()}`);

  if (dryRun) {
    console.log('Dry run — no changes written.');
    process.exit(0);
  }

  if ((existing.roles ?? []).includes('admin')) {
    logAdminAudit({
      action: 'role.grant',
      actor,
      targetUserId: existing.userId,
      targetEmail: email,
      targetUsername: existing.username,
      role: 'admin',
      rolesBefore: existing.roles ?? [],
      rolesAfter: existing.roles ?? [],
      result: 'noop',
      reason: 'already_admin',
    });
    console.log('Account already has admin role. No change.');
    process.exit(0);
  }

  const result = grantAccountRole({ email, role: 'admin', actor });
  const sessionsUpdated = updateActiveSessionRolesForUser(
    result.account.userId,
    result.rolesAfter,
  );

  logAdminAudit({
    action: 'role.grant',
    actor,
    targetUserId: result.account.userId,
    targetEmail: result.account.email ?? email,
    targetUsername: result.account.username,
    role: 'admin',
    rolesBefore: result.rolesBefore,
    rolesAfter: result.rolesAfter,
    result: 'ok',
    meta: { sessionsUpdated },
  });

  console.log('');
  console.log('Admin role granted successfully.');
  console.log(`  roles:            ${result.rolesAfter.join(', ')}`);
  console.log(`  sessions updated: ${sessionsUpdated}`);
  console.log('Re-login is recommended if an old session still lacks admin.');
} catch (err) {
  const code = err?.code || err?.message || 'error';
  try {
    logAdminAudit({
      action: 'role.grant',
      actor,
      targetEmail: email,
      role: 'admin',
      result: 'error',
      reason: String(code).slice(0, 200),
    });
  } catch {
    /* ignore */
  }
  console.error('Grant failed:', err.message);
  process.exit(1);
}

// Keep configure helpers referenced for future env path overrides
void configureAccountStore;
void configureAdminAuditStore;

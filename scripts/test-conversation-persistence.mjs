#!/usr/bin/env node
/**
 * Phase 1A regression — conversation persistence
 * Run: node scripts/test-conversation-persistence.mjs
 *
 * Boots a real HTTP server exercising the actual server/conversations.js
 * store functions and the same persist-before/persist-after-success flow
 * wired into POST /api/chat (simulated model call so this runs without
 * an OpenAI key — the persistence logic under test is identical).
 */

import express from 'express';
import { createServer } from 'http';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const tmpDir = mkdtempSync(join(tmpdir(), 'atlas-conv-'));
process.env.ATLAS_CONV_MAX_PER_USER = '3';
process.env.ATLAS_CONV_MAX_MESSAGES = '5';
process.env.ATLAS_CONV_MAX_MESSAGE_CHARS = '50';

const {
  configureConversationStore,
  resetConversationStoreForTests,
  appendMessage,
  getConversation,
  listUserConversations,
  deleteConversation,
  deleteAllUserConversations,
} = await import('../server/conversations.js');

configureConversationStore(join(tmpDir, 'conversations.json'));
resetConversationStoreForTests();

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

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const userId = req.header('x-test-user-id');
    const authenticated = req.header('x-test-authenticated') === '1';
    req.auth = authenticated
      ? { authenticated: true, userId, isAnonymous: false }
      : { authenticated: true, userId: userId || 'anonymous:test', isAnonymous: true };
    next();
  });

  // Mirrors the exact persist-before/persist-after-success flow in server/index.js's
  // POST /api/chat — with a stubbed model call so no OpenAI key is needed.
  app.post('/test-chat', async (req, res) => {
    const canPersist = Boolean(req.auth?.authenticated) && !req.auth?.isAnonymous;
    let conversationId =
      typeof req.body?.conversationId === 'string' ? req.body.conversationId.trim() : null;
    const clientRequestId =
      typeof req.body?.clientRequestId === 'string' ? req.body.clientRequestId.trim() : null;

    if (canPersist) {
      let alreadyPersisted = false;
      if (conversationId && clientRequestId) {
        const existing = getConversation(req.auth.userId, conversationId);
        alreadyPersisted = Boolean(existing?.messages?.some((m) => m.clientRequestId === clientRequestId));
      }
      if (!alreadyPersisted) {
        const userWrite = await appendMessage(req.auth.userId, conversationId, {
          role: 'user',
          content: req.body.message,
          hasImage: Boolean(req.body.image),
          imageMimeType: req.body.image?.mimeType ?? null,
          clientRequestId,
        });
        if (userWrite.ok) conversationId = userWrite.conversationId;
      }
    }

    // Simulated model call — test controls success/failure via header.
    const simulateFailure = req.header('x-simulate-model-failure') === '1';
    const modelResult = simulateFailure
      ? { status: 'error', reply: null }
      : { status: 'ok', reply: `echo: ${req.body.message}` };

    if (canPersist && conversationId && modelResult.status !== 'error' && modelResult.reply) {
      await appendMessage(req.auth.userId, conversationId, {
        role: 'assistant',
        content: modelResult.reply,
      });
    }

    return res.json({
      ok: modelResult.status !== 'error',
      reply: modelResult.reply,
      conversationId: conversationId || undefined,
    });
  });

  app.get('/api/conversations', (req, res) => {
    if (!req.auth?.authenticated || req.auth?.isAnonymous) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    return res.json({ ok: true, conversations: listUserConversations(req.auth.userId) });
  });

  app.get('/api/conversations/:id', (req, res) => {
    if (!req.auth?.authenticated || req.auth?.isAnonymous) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    const conversation = getConversation(req.auth.userId, req.params.id);
    if (!conversation) return res.status(404).json({ ok: false, error: 'Conversation not found' });
    return res.json({ ok: true, conversation });
  });

  app.delete('/api/conversations/:id', async (req, res) => {
    if (!req.auth?.authenticated || req.auth?.isAnonymous) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    const result = await deleteConversation(req.auth.userId, req.params.id);
    if (!result.ok) return res.status(404).json({ ok: false, error: 'Conversation not found' });
    return res.json({ ok: true, deleted: true });
  });

  return app;
}

async function withServer(fn) {
  const app = buildApp();
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function authHeaders(userId, authenticated, extra = {}) {
  return {
    'Content-Type': 'application/json',
    'x-test-user-id': userId,
    'x-test-authenticated': authenticated ? '1' : '0',
    ...extra,
  };
}

async function main() {
  console.log('\n\u2500\u2500 authenticated conversation create + turn ordering \u2500\u2500');
  await withServer(async (base) => {
    resetConversationStoreForTests();
    const r1 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:userA', true),
      body: JSON.stringify({ message: 'merhaba', clientRequestId: 'req-1' }),
    });
    const b1 = await r1.json();
    ok('authenticated conversation created (conversationId returned)', Boolean(b1.conversationId));

    const stored = getConversation('web:userA', b1.conversationId);
    ok('user turn persisted', stored?.messages?.[0]?.role === 'user' && stored.messages[0].content === 'merhaba');
    ok(
      'assistant turn persisted after user turn (correct order)',
      stored?.messages?.[1]?.role === 'assistant' && stored.messages[1].content === 'echo: merhaba',
    );
  });

  console.log('\n\u2500\u2500 refresh/read restores history \u2500\u2500');
  await withServer(async (base) => {
    resetConversationStoreForTests();
    const r1 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:userB', true),
      body: JSON.stringify({ message: 'birinci', clientRequestId: 'r1' }),
    });
    const { conversationId } = await r1.json();

    const rList = await fetch(`${base}/api/conversations`, { headers: authHeaders('web:userB', true) });
    const bList = await rList.json();
    ok('conversation appears in list after "refresh"', bList.conversations.some((c) => c.id === conversationId));

    const rGet = await fetch(`${base}/api/conversations/${conversationId}`, {
      headers: authHeaders('web:userB', true),
    });
    const bGet = await rGet.json();
    ok('GET restores full message history', bGet.conversation.messages.length === 2);
  });

  console.log('\n\u2500\u2500 new chat creates separate conversation \u2500\u2500');
  await withServer(async (base) => {
    resetConversationStoreForTests();
    const r1 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:userC', true),
      body: JSON.stringify({ message: 'first chat', clientRequestId: 'nc-1' }),
    });
    const { conversationId: firstId } = await r1.json();

    // "New chat" = client omits conversationId on the next send
    const r2 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:userC', true),
      body: JSON.stringify({ message: 'second chat', clientRequestId: 'nc-2' }),
    });
    const { conversationId: secondId } = await r2.json();

    ok('new chat gets a different conversationId', firstId !== secondId);
    const list = listUserConversations('web:userC');
    ok('both conversations exist independently', list.length === 2);
  });

  console.log('\n\u2500\u2500 ownership / IDOR protection \u2500\u2500');
  await withServer(async (base) => {
    resetConversationStoreForTests();
    const r1 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:owner', true),
      body: JSON.stringify({ message: 'private', clientRequestId: 'own-1' }),
    });
    const { conversationId } = await r1.json();

    const rGetCross = await fetch(`${base}/api/conversations/${conversationId}`, {
      headers: authHeaders('web:attacker', true),
    });
    ok('cross-user GET denied (404, not leaked)', rGetCross.status === 404);

    const rDelCross = await fetch(`${base}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: authHeaders('web:attacker', true),
    });
    ok('cross-user DELETE denied', rDelCross.status === 404);

    const stillThere = getConversation('web:owner', conversationId);
    ok('conversation untouched after attacker DELETE attempt', stillThere?.messages?.length === 2);
  });

  console.log('\n\u2500\u2500 client userId spoof blocked (server derives identity from auth, not body) \u2500\u2500');
  await withServer(async (base) => {
    resetConversationStoreForTests();
    const r1 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:realUser', true),
      body: JSON.stringify({ message: 'hello', userId: 'web:someoneElse', clientRequestId: 'spoof-1' }),
    });
    const { conversationId } = await r1.json();
    const real = getConversation('web:realUser', conversationId);
    const spoofed = getConversation('web:someoneElse', conversationId);
    ok('message persisted under the real authenticated user', Boolean(real));
    ok('spoofed userId in body has no effect', spoofed === null);
  });

  console.log('\n\u2500\u2500 guest / anonymous durable persistence \u2500\u2500');
  await withServer(async (base) => {
    resetConversationStoreForTests();
    const r1 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('anonymous:guest1', false),
      body: JSON.stringify({ message: 'guest message', clientRequestId: 'g1' }),
    });
    const b1 = await r1.json();
    ok('guest response has no conversationId (never durably created)', !b1.conversationId);
    const list = listUserConversations('anonymous:guest1');
    ok('nothing persisted for guest userId', list.length === 0);
  });

  console.log('\n\u2500\u2500 provider/model failure does not create a fake assistant turn \u2500\u2500');
  await withServer(async (base) => {
    resetConversationStoreForTests();
    const r1 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:failUser', true, { 'x-simulate-model-failure': '1' }),
      body: JSON.stringify({ message: 'will fail', clientRequestId: 'fail-1' }),
    });
    const { conversationId } = await r1.json();
    const stored = getConversation('web:failUser', conversationId);
    ok('user message still persisted despite model failure', stored?.messages?.length === 1);
    ok('no assistant turn written on failure', stored?.messages?.every((m) => m.role !== 'assistant'));
  });

  console.log('\n\u2500\u2500 retry does not duplicate the persisted user turn \u2500\u2500');
  await withServer(async (base) => {
    resetConversationStoreForTests();
    const r1 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:retryUser', true, { 'x-simulate-model-failure': '1' }),
      body: JSON.stringify({ message: 'retry me', clientRequestId: 'retry-1' }),
    });
    const { conversationId } = await r1.json();

    // Client retries with the SAME conversationId + SAME clientRequestId (as Chat.tsx now does)
    await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:retryUser', true),
      body: JSON.stringify({ message: 'retry me', conversationId, clientRequestId: 'retry-1' }),
    });

    const stored = getConversation('web:retryUser', conversationId);
    const userTurns = stored.messages.filter((m) => m.role === 'user');
    ok('retry with same clientRequestId does not duplicate the user turn', userTurns.length === 1);
    ok('retry still gets an assistant reply once it succeeds', stored.messages.some((m) => m.role === 'assistant'));
  });

  console.log('\n\u2500\u2500 image base64 not persisted \u2500\u2500');
  await withServer(async (base) => {
    resetConversationStoreForTests();
    const r1 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:imgUser', true),
      body: JSON.stringify({
        message: 'bir görsel',
        image: { mimeType: 'image/jpeg', base64: 'QUFBQUFBQUFBQUFBQUFBQQ==' },
        clientRequestId: 'img-1',
      }),
    });
    const { conversationId } = await r1.json();
    const stored = getConversation('web:imgUser', conversationId);
    const userMsg = stored.messages[0];
    ok('hasImage metadata stored', userMsg.hasImage === true);
    ok('imageMimeType metadata stored', userMsg.imageMimeType === 'image/jpeg');
    ok('no base64 field anywhere on the stored message', !JSON.stringify(userMsg).includes('QUFBQUFBQUFBQUFBQUFBQQ'));
  });

  console.log('\n\u2500\u2500 delete works \u2500\u2500');
  await withServer(async (base) => {
    resetConversationStoreForTests();
    const r1 = await fetch(`${base}/test-chat`, {
      method: 'POST',
      headers: authHeaders('web:delUser', true),
      body: JSON.stringify({ message: 'to delete', clientRequestId: 'del-1' }),
    });
    const { conversationId } = await r1.json();
    const rDel = await fetch(`${base}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: authHeaders('web:delUser', true),
    });
    ok('delete succeeds for the owner', rDel.status === 200);
    ok('conversation gone after delete', getConversation('web:delUser', conversationId) === null);
  });

  console.log('\n\u2500\u2500 erase-user-data removes conversations \u2500\u2500');
  await withServer(async () => {
    resetConversationStoreForTests();
    await appendMessage('web:eraseUser', null, { role: 'user', content: 'a' });
    await appendMessage('web:eraseUser', null, { role: 'user', content: 'b' });
    const before = listUserConversations('web:eraseUser');
    ok('setup: 2 conversations exist before erase', before.length === 2);
    const erased = await deleteAllUserConversations('web:eraseUser');
    ok('erase reports correct deleted count', erased.ok && erased.deleted === 2);
    const after = listUserConversations('web:eraseUser');
    ok('all conversations gone after erase', after.length === 0);
  });

  console.log('\n\u2500\u2500 storage bounds enforced \u2500\u2500');
  await withServer(async () => {
    resetConversationStoreForTests();
    // ATLAS_CONV_MAX_PER_USER=3 for this test run
    for (let i = 0; i < 5; i++) {
      await appendMessage('web:boundsUser', null, { role: 'user', content: `conv ${i}` });
    }
    const list = listUserConversations('web:boundsUser');
    ok('conversation count capped at configured max (3)', list.length === 3);

    // ATLAS_CONV_MAX_MESSAGES=5 for this test run
    const single = await appendMessage('web:boundsUser2', null, { role: 'user', content: 'm0' });
    let convId = single.conversationId;
    for (let i = 1; i < 8; i++) {
      const r = await appendMessage('web:boundsUser2', convId, { role: 'user', content: `m${i}` });
      convId = r.conversationId;
    }
    const conv = getConversation('web:boundsUser2', convId);
    ok('message count capped at configured max (5)', conv.messages.length === 5);
    ok('sliding window kept the most recent messages', conv.messages[conv.messages.length - 1].content === 'm7');

    // ATLAS_CONV_MAX_MESSAGE_CHARS=50 for this test run
    const longMsg = await appendMessage('web:boundsUser3', null, {
      role: 'user',
      content: 'x'.repeat(200),
    });
    const convLong = getConversation('web:boundsUser3', longMsg.conversationId);
    ok('message content truncated to configured max chars (50)', convLong.messages[0].content.length === 50);
  });

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
});

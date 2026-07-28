import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createZip } from './zip-utils.js';
import { callOpenAI } from './openai-client.js';
import { processAtlasMessage } from './atlas-message-service.js';
import { normalizeWebChatRequest, toWebChatResponse } from './channel-adapters.js';
import {
  deleteMemoryField,
  deleteUserMemory,
  getMemoryField,
  getUserMemory,
  isValidUserId,
  setMemoryField,
  setUserMemory,
  updateUserMemory,
} from './user-memory.js';
import {
  deleteAnalysisRecord,
  getAnalysisRecord,
  listUserAnalyses,
  saveAnalysisRecord,
} from './analysis-archive.js';
import { Runner } from '../runner/runner.js';
import { routeTask } from '../runner/task-router.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const GENERATED_DIR = join(__dirname, 'generated');
const runner = new Runner();

// Ensure generated/ exists on startup
if (!existsSync(GENERATED_DIR)) {
  mkdirSync(GENERATED_DIR, { recursive: true });
  console.log(`[ATLAS] Created ${GENERATED_DIR}`);
}

const MIME_TYPES = {
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

// ══════════════════════════════════════════════════════════════════════
// AI ENDPOINTS (unchanged)
// ══════════════════════════════════════════════════════════════════════

app.get('/api/ai/health', (_req, res) => {
  res.json({
    status: 'ok',
    configured: OPENAI_API_KEY.length > 0,
    model: DEFAULT_MODEL,
    webChat: true,
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    memory: true,
    modelProvider: OPENAI_API_KEY.length > 0,
  });
});

app.post('/api/ai/complete', async (req, res) => {
  const { systemPrompt, userPrompt, model, temperature, maxTokens } = req.body;

  if (!userPrompt) {
    return res.status(400).json({ error: 'userPrompt is required' });
  }
  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY not set in .env' });
  }

  try {
    const result = await callOpenAI({
      systemPrompt,
      userPrompt,
      model: model || DEFAULT_MODEL,
      temperature,
      maxTokens,
      apiKey: OPENAI_API_KEY,
    });

    console.log(`[ATLAS] ✓ ${result.model} | ${result.tokensUsed} tok | $${result.costUsd.toFixed(4)} | ${result.latencyMs}ms`);
    return res.json(result);
  } catch (err) {
    console.error(`[ATLAS] ${err.message}`);
    const status = err.status ?? 500;
    return res.status(status).json({ error: err.message });
  }
});

// ── Atlas Chat — shared intelligence pipeline (Web + Telegram via HTTP) ──
app.post('/api/chat', async (req, res) => {
  try {
    const normalized = normalizeWebChatRequest(req.body);
    const result = await processAtlasMessage(normalized, {
      mode: req.body.mode,
      model: req.body.model || DEFAULT_MODEL,
      temperature: req.body.temperature,
      maxTokens: req.body.maxTokens,
      runner,
    });

    const response = toWebChatResponse(result);
    const httpStatus = result.status === 'error' && result.errorCode === 'INVALID_INPUT' ? 400 : 200;

    console.log(
      `[ATLAS] ✓ chat/${normalized.channel} (${response.profile}/${response.mode})` +
        `${response.memoryHandled ? ' [memory]' : ''} | ${response.engine ?? response.model} | ${response.tokensUsed} tok`,
    );
    return res.status(httpStatus).json(response);
  } catch (err) {
    if (err.message?.includes('userId must be') || err.message?.includes('message is required')) {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[ATLAS] chat error: ${err.message}`);
    const status = err.status ?? 500;
    return res.status(status).json({ error: err.message });
  }
});

// ── Channel-neutral Atlas message endpoint (explicit adapter contract) ──
app.post('/api/atlas/message', async (req, res) => {
  const { channel = 'web' } = req.body ?? {};

  try {
    const normalized =
      channel === 'telegram'
        ? {
            channel: 'telegram',
            userId: String(req.body.userId ?? ''),
            conversationId: String(req.body.conversationId ?? req.body.userId ?? ''),
            message: String(req.body.message ?? '').trim(),
            history: Array.isArray(req.body.history) ? req.body.history : [],
            username: req.body.username,
            displayName: req.body.displayName,
            metadata: req.body.metadata ?? {},
            context: req.body.context ?? {},
          }
        : normalizeWebChatRequest(req.body);

    if (channel === 'telegram' && !normalized.message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await processAtlasMessage(normalized, {
      model: req.body.model || DEFAULT_MODEL,
      temperature: req.body.temperature,
      maxTokens: req.body.maxTokens,
      runner,
    });

    return res.json(result);
  } catch (err) {
    console.error(`[ATLAS] atlas/message error: ${err.message}`);
    return res.status(400).json({
      status: 'error',
      reply: err.message,
      errorCode: 'INVALID_INPUT',
    });
  }
});

// ══════════════════════════════════════════════════════════════════════
// USER MEMORY ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

app.get('/api/memory/:userId', (req, res) => {
  const { userId } = req.params;
  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  try {
    const memory = getUserMemory(userId);
    return res.json({ userId, memory });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/memory/:userId', async (req, res) => {
  const { userId } = req.params;
  const { memory } = req.body ?? {};

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  if (!memory || typeof memory !== 'object') {
    return res.status(400).json({ error: 'memory object is required' });
  }

  const result = await setUserMemory(userId, memory);
  if (!result.ok) {
    return res.status(500).json({ error: result.error });
  }
  return res.json({ userId, memory: result.memory, saved: true });
});

app.patch('/api/memory/:userId', async (req, res) => {
  const { userId } = req.params;
  const partial = req.body ?? {};

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  const result = await updateUserMemory(userId, partial);
  if (!result.ok) {
    return res.status(500).json({ error: result.error });
  }
  return res.json({ userId, memory: result.memory, saved: true });
});

app.delete('/api/memory/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  const result = await deleteUserMemory(userId);
  if (!result.ok) {
    const status = result.error === 'User memory not found' ? 404 : 500;
    return res.status(status).json({ error: result.error });
  }
  return res.json({ userId, deleted: true });
});

app.get('/api/memory/:userId/field', (req, res) => {
  const { userId } = req.params;
  const path = req.query.path;

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  if (typeof path !== 'string' || !path.trim()) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  try {
    const value = getMemoryField(userId, path);
    if (value === undefined) {
      return res.status(404).json({ error: 'Field not found' });
    }
    return res.json({ userId, path, value });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.put('/api/memory/:userId/field', async (req, res) => {
  const { userId } = req.params;
  const path = req.query.path ?? req.body?.path;
  const { value } = req.body ?? {};

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  if (typeof path !== 'string' || !path.trim()) {
    return res.status(400).json({ error: 'path is required' });
  }

  const result = await setMemoryField(userId, path, value);
  if (!result.ok) {
    return res.status(500).json({ error: result.error });
  }
  return res.json({ userId, path, value, saved: true, memory: result.memory });
});

app.delete('/api/memory/:userId/field', async (req, res) => {
  const { userId } = req.params;
  const path = req.query.path;

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  if (typeof path !== 'string' || !path.trim()) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  const result = await deleteMemoryField(userId, path);
  if (!result.ok) {
    const status = result.error === 'Field not found' ? 404 : 500;
    return res.status(status).json({ error: result.error });
  }
  return res.json({ userId, path, deleted: true, memory: result.memory });
});

// ══════════════════════════════════════════════════════════════════════
// ANALYSIS ARCHIVE ENDPOINTS (separate from profile memory)
// ══════════════════════════════════════════════════════════════════════

app.get('/api/archive/:userId', (req, res) => {
  const { userId } = req.params;
  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  try {
    const analyses = listUserAnalyses(userId);
    return res.json({ userId, analyses });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/archive/:userId/:analysisId', (req, res) => {
  const { userId, analysisId } = req.params;
  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  const record = getAnalysisRecord(userId, analysisId);
  if (!record) {
    return res.status(404).json({ error: 'Analysis not found' });
  }
  return res.json(record);
});

app.post('/api/archive/:userId', async (req, res) => {
  const { userId } = req.params;
  const { record } = req.body ?? {};

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  if (!record || typeof record !== 'object') {
    return res.status(400).json({ error: 'record object is required' });
  }

  const result = await saveAnalysisRecord(userId, record);
  if (!result.ok) {
    return res.status(500).json({ error: result.error });
  }
  return res.json({ userId, record: result.record, saved: true });
});

app.delete('/api/archive/:userId/:analysisId', async (req, res) => {
  const { userId, analysisId } = req.params;

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  const result = await deleteAnalysisRecord(userId, analysisId);
  if (!result.ok) {
    const status = result.error === 'Analysis not found' ? 404 : 500;
    return res.status(status).json({ error: result.error });
  }
  return res.json({ userId, analysisId, deleted: true });
});

// ══════════════════════════════════════════════════════════════════════
// ASSET PERSISTENCE ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

// ── Save a completed pipeline package to disk ─────────────────────────
app.post('/api/assets/save', (req, res) => {
  const { package: pkg } = req.body;

  if (!pkg || !pkg.topic || !pkg.script) {
    return res.status(400).json({ error: 'Invalid package — missing topic or script' });
  }

  // Create timestamped folder
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const folderName = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const folderPath = join(GENERATED_DIR, folderName);

  try {
    mkdirSync(folderPath, { recursive: true });
  } catch (err) {
    console.error(`[ATLAS] Failed to create folder: ${err.message}`);
    return res.status(500).json({ error: `Failed to create folder: ${err.message}` });
  }

  // Define files to write
  const files = [
    {
      name: 'script.md',
      content: `# ${pkg.topic}\n\n> ${pkg.hook || ''}\n\n${pkg.script}`,
    },
    {
      name: 'visual-prompts.md',
      content: `# Visual Prompts — ${pkg.topic}\n\n` +
        (Array.isArray(pkg.visualPrompts)
          ? pkg.visualPrompts.map((vp) => `## Scene ${vp.scene} (${vp.duration})\n\n${vp.prompt}\n`).join('\n')
          : `Raw output:\n\n${JSON.stringify(pkg.visualPrompts, null, 2)}`),
    },
    {
      name: 'thumbnail-brief.md',
      content: `# Thumbnail Brief — ${pkg.topic}\n\n${pkg.thumbnailConcept}`,
    },
    {
      name: 'seo-package.md',
      content: `# SEO Package — ${pkg.topic}\n\n## Title Options\n\n` +
        (pkg.titles || []).map((t, i) => `${i + 1}. ${t}`).join('\n') +
        `\n\n## Description\n\n${pkg.description || ''}` +
        `\n\n## Hashtags\n\n${(pkg.hashtags || []).join(' ')}`,
    },
    {
      name: 'final-package.json',
      content: JSON.stringify(pkg, null, 2),
    },
  ];

  // Write and verify each file
  const written = [];
  for (const file of files) {
    const filePath = join(folderPath, file.name);
    try {
      writeFileSync(filePath, file.content, 'utf-8');

      // Verify the file actually exists on disk
      if (!existsSync(filePath)) {
        console.error(`[ATLAS] Write verification failed: ${filePath}`);
        return res.status(500).json({ error: `Write verification failed for ${file.name}` });
      }

      const stat = statSync(filePath);
      written.push({
        name: file.name,
        size: stat.size,
        path: `${folderName}/${file.name}`,
      });
    } catch (err) {
      console.error(`[ATLAS] Failed to write ${file.name}: ${err.message}`);
      return res.status(500).json({ error: `Failed to write ${file.name}: ${err.message}` });
    }
  }

  console.log(`[ATLAS] ✓ Saved ${written.length} files to ${folderName}/`);
  return res.json({ folder: folderName, files: written });
});

// ── List all generated assets ─────────────────────────────────────────
app.get('/api/assets', (_req, res) => {
  try {
    if (!existsSync(GENERATED_DIR)) {
      return res.json({ productions: [] });
    }

    const folders = readdirSync(GENERATED_DIR)
      .filter((name) => {
        const fullPath = join(GENERATED_DIR, name);
        return statSync(fullPath).isDirectory();
      })
      .sort()
      .reverse(); // newest first

    const productions = folders.map((folder) => {
      const folderPath = join(GENERATED_DIR, folder);
      const files = readdirSync(folderPath)
        .filter((f) => statSync(join(folderPath, f)).isFile())
        .map((f) => {
          const stat = statSync(join(folderPath, f));
          return {
            name: f,
            size: stat.size,
            path: `${folder}/${f}`,
            modified: stat.mtime.toISOString(),
          };
        });

      // Try to read topic from final-package.json
      let topic = folder;
      const pkgPath = join(folderPath, 'final-package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkgData = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          if (pkgData.topic) topic = pkgData.topic;
        } catch { /* use folder name */ }
      }

      const folderStat = statSync(folderPath);
      return {
        folder,
        topic,
        created: folderStat.mtime.toISOString(),
        files,
      };
    });

    return res.json({ productions });
  } catch (err) {
    console.error(`[ATLAS] Failed to list assets: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── Download a specific generated file ────────────────────────────────
app.get('/api/assets/:folder/:file/download', (req, res) => {
  const { folder, file } = req.params;

  // Prevent path traversal
  if (folder.includes('..') || file.includes('..')) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const filePath = join(GENERATED_DIR, folder, file);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const ext = extname(file).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file}"`);

  const content = readFileSync(filePath);
  return res.send(content);
});

// ── Download a full production as a real ZIP archive ──────────────────
const PACKAGE_FILES = [
  'script.md',
  'visual-prompts.md',
  'thumbnail-brief.md',
  'seo-package.md',
  'final-package.json',
];

app.get('/api/assets/:folder/download-zip', (req, res) => {
  const { folder } = req.params;

  // Prevent path traversal
  if (folder.includes('..')) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const folderPath = join(GENERATED_DIR, folder);

  if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
    return res.status(404).json({ error: 'Production not found' });
  }

  try {
    const entries = [];
    for (const fileName of PACKAGE_FILES) {
      const filePath = join(folderPath, fileName);
      if (existsSync(filePath)) {
        entries.push({ name: fileName, content: readFileSync(filePath) });
      }
    }

    if (entries.length === 0) {
      return res.status(404).json({ error: 'No package files found for this production' });
    }

    const zipBuffer = createZip(entries);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${folder}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    return res.send(zipBuffer);
  } catch (err) {
    console.error(`[ATLAS] Failed to build ZIP for ${folder}: ${err.message}`);
    return res.status(500).json({ error: `Failed to build ZIP: ${err.message}` });
  }
});
// ══════════════════════════════════════════════════════════════════════
// PERSONAL ANALYSIS ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

// ── Run the Personal Analysis Pipeline (routeTask → core-engine) ──────
// task_type is intentionally hardcoded to 'personal-analysis' below and
// is never read from the request body — this route exists for exactly
// one purpose, and this guarantees it can never fall through to the
// Content Pipeline regardless of what a caller sends.
app.post('/api/personal-analysis', async (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const { task_id, subject_id, subject_profile, analysis_inputs, constraints } = body;

  if (typeof task_id !== 'string' || task_id.trim().length === 0) {
    return res.status(400).json({ error: 'task_id is required and must be a non-empty string' });
  }
  if (typeof subject_id !== 'string' || subject_id.trim().length === 0) {
    return res.status(400).json({ error: 'subject_id is required and must be a non-empty string' });
  }
  if (typeof subject_profile !== 'object' || subject_profile === null || Array.isArray(subject_profile)) {
    return res.status(400).json({ error: 'subject_profile is required and must be an object' });
  }
  if (analysis_inputs !== undefined && (typeof analysis_inputs !== 'object' || analysis_inputs === null || Array.isArray(analysis_inputs))) {
    return res.status(400).json({ error: 'analysis_inputs, if provided, must be an object' });
  }
  if (constraints !== undefined && !Array.isArray(constraints)) {
    return res.status(400).json({ error: 'constraints, if provided, must be an array' });
  }

  try {
    const result = await routeTask(
      {
        task_type: 'personal-analysis',
        task_id,
        subject_id,
        subject_profile,
        analysis_inputs,
        constraints,
      },
      runner
    );

    // The agent/provider call itself failed (routeTask/runPersonalAnalysis-
    // PipelineRunner's ok: false, result: null case) — this is a gateway
    // failure, not a client input problem or a core-engine business
    // outcome.
    if (result.result === null) {
      console.error(`[ATLAS] Personal analysis call failed for task ${task_id}: ${JSON.stringify(result.trace?.stages?.['core-engine']?.error)}`);
      return res.status(502).json({
        error: 'core-engine call did not succeed',
        stoppedAt: result.stoppedAt,
        detail: result.trace?.stages?.['core-engine']?.error ?? null,
      });
    }

    // Beyond this point, core-engine was reached and returned an envelope.
    // "complete" and non-"complete" (insufficient_data | reject) are both
    // valid business outcomes of core-engine's own logic, not HTTP errors —
    // both are reported as 200 with the envelope as the body.
    console.log(`[ATLAS] ✓ personal-analysis task ${task_id} → status: ${result.result.status}`);
    return res.status(200).json(result.result);

  } catch (err) {
    console.error(`[ATLAS] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('');
  console.log('  ATLAS Backend');
  console.log(`  http://localhost:${PORT}`);
  console.log(`  OpenAI: ${OPENAI_API_KEY ? '✓ Key configured' : '✗ No key — add OPENAI_API_KEY to .env'}`);
  console.log(`  Model:  ${DEFAULT_MODEL}`);
  console.log(`  Assets: ${GENERATED_DIR}`);
  console.log('  Routes: POST /api/chat, POST /api/atlas/message, GET /api/ai/health');
  console.log('  Memory: ✓ JSON persistence initialized');
  console.log(`  Web Chat: ✓ shared pipeline active`);
  console.log(`  Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? 'configured (start server/telegram.js separately)' : 'not configured'}`);
  console.log('');
});
 
/**
 * Persistent audio job store under data/audio-jobs/<jobId>/.
 * Original files are never overwritten.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  copyFileSync,
  statSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomBytes } from 'crypto';
import { assertSafePath, safeFileName } from './audio-safety.js';
import { AUDIO_ERROR_CODES, AudioStudioError } from './audio-errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const AUDIO_JOBS_ROOT = join(__dirname, '..', '..', 'data', 'audio-jobs');

export const JOB_STATUSES = Object.freeze([
  'received',
  'validating',
  'insufficient_information',
  'queued',
  'analyzing',
  'processing',
  'partially_completed',
  'completed',
  'failed',
  'cancelled',
  'unsupported',
]);

/**
 * @returns {string}
 */
export function createJobId() {
  return `audio_job_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function ensureRoot() {
  if (!existsSync(AUDIO_JOBS_ROOT)) {
    mkdirSync(AUDIO_JOBS_ROOT, { recursive: true });
  }
}

/**
 * @param {string} jobId
 */
export function jobDir(jobId) {
  ensureRoot();
  const id = String(jobId || '');
  if (!/^audio_job_[a-z0-9_]+$/i.test(id)) {
    throw new AudioStudioError(AUDIO_ERROR_CODES.INVALID_INPUT, 'Invalid jobId');
  }
  return assertSafePath(AUDIO_JOBS_ROOT, id);
}

/**
 * @param {Partial<{
 *   userId: string,
 *   displayName: string|null,
 *   channel: string,
 *   chatId: string|null,
 *   messageId: string|null,
 *   conversationId: string|null,
 *   detectedType: string|null,
 *   intent: string|null,
 *   requestedOperations: string[],
 *   targetProfile: object,
 *   capabilityAssessment: object,
 *   sourceFile: object|null,
 * }>} seed
 */
export function createAudioJob(seed = {}) {
  ensureRoot();
  const jobId = createJobId();
  const dir = jobDir(jobId);
  mkdirSync(join(dir, 'original'), { recursive: true });
  mkdirSync(join(dir, 'normalized'), { recursive: true });
  mkdirSync(join(dir, 'stems'), { recursive: true });
  mkdirSync(join(dir, 'processed'), { recursive: true });
  mkdirSync(join(dir, 'output'), { recursive: true });
  mkdirSync(join(dir, 'reports'), { recursive: true });

  const now = new Date().toISOString();
  const job = {
    jobId,
    userId: seed.userId || null,
    displayName: seed.displayName || null,
    channel: seed.channel || 'unknown',
    chatId: seed.chatId || null,
    messageId: seed.messageId || null,
    conversationId: seed.conversationId || null,
    sourceFile: seed.sourceFile || null,
    detectedType: seed.detectedType || null,
    intent: seed.intent || null,
    requestedOperations: seed.requestedOperations || [],
    targetProfile: seed.targetProfile || {
      genre: null,
      mood: null,
      referenceTrack: null,
      vocalPriority: null,
      instrumentPriority: null,
      outputFormat: 'wav',
    },
    capabilityAssessment: seed.capabilityAssessment || {
      available: [],
      unavailable: [],
      requiresProvider: [],
    },
    status: 'received',
    createdAt: now,
    updatedAt: now,
    errors: [],
    outputs: [],
    consents: {
      externalUpload: false,
      generation: false,
      persistMemory: false,
    },
    analysisReport: null,
    stages: [],
  };

  writeJob(job);
  return job;
}

/**
 * @param {object} job
 */
export function writeJob(job) {
  const dir = jobDir(job.jobId);
  job.updatedAt = new Date().toISOString();
  writeFileSync(join(dir, 'job.json'), JSON.stringify(job, null, 2), 'utf8');
  return job;
}

/**
 * @param {string} jobId
 */
export function readJob(jobId) {
  const dir = jobDir(jobId);
  const path = join(dir, 'job.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} jobId
 * @param {Partial<object>} patch
 */
export function updateJob(jobId, patch) {
  const job = readJob(jobId);
  if (!job) throw new AudioStudioError(AUDIO_ERROR_CODES.JOB_NOT_FOUND);
  Object.assign(job, patch);
  return writeJob(job);
}

/**
 * Preserve original file under job/original/. Never overwrite.
 * @param {string} jobId
 * @param {string} sourcePath
 * @param {{ fileName?: string, mimeType?: string|null, fileId?: string|null, checksum?: string|null }} meta
 */
export function storeOriginalFile(jobId, sourcePath, meta = {}) {
  const dir = jobDir(jobId);
  const originalDir = join(dir, 'original');
  const name = safeFileName(meta.fileName || 'original.bin');
  const versioned = existsSync(join(originalDir, name))
    ? `${Date.now()}_${name}`
    : name;
  const dest = join(originalDir, versioned);
  copyFileSync(sourcePath, dest);
  const size = statSync(dest).size;
  const checksum =
    meta.checksum ||
    createHash('sha256').update(readFileSync(dest)).digest('hex');

  const job = readJob(jobId);
  job.sourceFile = {
    fileId: meta.fileId || null,
    fileName: name,
    mimeType: meta.mimeType || null,
    localPath: dest,
    storedName: versioned,
    size,
    duration: meta.duration ?? null,
    checksum,
  };
  job.status = job.status === 'received' ? 'validating' : job.status;
  writeJob(job);
  return job;
}

/**
 * @param {string} jobId
 * @param {{ version?: string, path: string, kind?: string, format?: string }} output
 */
export function addJobOutput(jobId, output) {
  const job = readJob(jobId);
  if (!job) throw new AudioStudioError(AUDIO_ERROR_CODES.JOB_NOT_FOUND);
  const version = output.version || `v${(job.outputs?.length || 0) + 1}`;
  job.outputs = job.outputs || [];
  job.outputs.push({
    version,
    path: output.path,
    kind: output.kind || 'processed',
    format: output.format || null,
    createdAt: new Date().toISOString(),
  });
  writeJob(job);
  return job;
}

/**
 * @param {string} jobId
 */
export function deleteJob(jobId) {
  const dir = jobDir(jobId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  return true;
}

/**
 * @param {{ userId?: string, status?: string }} [filter]
 */
export function listJobs(filter = {}) {
  ensureRoot();
  const ids = readdirSync(AUDIO_JOBS_ROOT).filter((d) => d.startsWith('audio_job_'));
  const jobs = [];
  for (const id of ids) {
    const job = readJob(id);
    if (!job) continue;
    if (filter.userId && String(job.userId) !== String(filter.userId)) continue;
    if (filter.status && job.status !== filter.status) continue;
    jobs.push(job);
  }
  return jobs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/**
 * Aggregate running/queued counts + last error for health.
 */
export function getJobStats() {
  const jobs = listJobs();
  let running = 0;
  let queued = 0;
  let lastError = null;
  let lastErrorAt = '';
  for (const j of jobs) {
    if (j.status === 'processing' || j.status === 'analyzing') running += 1;
    if (j.status === 'queued' || j.status === 'received' || j.status === 'validating') queued += 1;
    if (j.errors?.length) {
      const err = j.errors[j.errors.length - 1];
      const at = err.at || j.updatedAt || '';
      if (at >= lastErrorAt) {
        lastErrorAt = at;
        lastError = err.code || err.message || 'error';
      }
    }
  }
  return { running, queued, lastError };
}

/**
 * Retention cleanup — delete jobs older than retention days.
 * @param {{ retentionDays?: number }} [opts]
 */
export function cleanupExpiredJobs(opts = {}) {
  const days = opts.retentionDays ?? Number(process.env.ATLAS_AUDIO_RETENTION_DAYS || 14);
  const cutoff = Date.now() - days * 86400_000;
  let removed = 0;
  for (const job of listJobs()) {
    const t = Date.parse(job.createdAt || 0);
    if (Number.isFinite(t) && t < cutoff) {
      deleteJob(job.jobId);
      removed += 1;
    }
  }
  return { removed, retentionDays: days };
}

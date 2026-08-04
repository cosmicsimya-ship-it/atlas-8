/**
 * Audio Studio HTTP API — job lifecycle for web (and authenticated clients).
 */

import { Router } from 'express';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  createAudioJob,
  readJob,
  updateJob,
  deleteJob,
  listJobs,
  storeOriginalFile,
  getJobStats,
  AUDIO_JOBS_ROOT,
  inspectAudioFile,
  getCapabilityRegistry,
  assessCapabilities,
  assertJobAccess,
  safeFileName,
  runAudioStudioTurn,
  AUDIO_ERROR_CODES,
  userMessageForAudioError,
  AudioStudioError,
  audioHealthSnapshot,
} from './audio-studio/index.js';
import { jobDir } from './audio-studio/audio-job-store.js';

/**
 * @param {{
 *   requireAuth?: import('express').RequestHandler,
 *   requireCsrf?: import('express').RequestHandler,
 *   rateLimit?: import('express').RequestHandler,
 * }} [deps]
 */
export function createAudioStudioRouter(deps = {}) {
  const router = Router();
  const auth = deps.requireAuth || ((_req, _res, next) => next());
  const csrf = deps.requireCsrf || ((_req, _res, next) => next());
  const limit = deps.rateLimit || ((_req, _res, next) => next());

  router.get('/health', async (_req, res) => {
    const registry = await getCapabilityRegistry();
    res.json({
      ok: true,
      audio: audioHealthSnapshot(registry, getJobStats()),
    });
  });

  router.get('/capabilities', async (_req, res) => {
    const registry = await getCapabilityRegistry();
    res.json({
      flags: registry.flags,
      audioUpload: registry.audioUpload,
      metadataInspection: registry.metadataInspection,
      transcription: registry.transcription,
      noiseReduction: registry.noiseReduction,
      stemSeparation: registry.stemSeparation,
      vocalTuning: registry.vocalTuning,
      mixing: registry.mixing,
      mastering: registry.mastering,
      instrumentGeneration: registry.instrumentGeneration,
      externalUpload: registry.externalUpload,
      ffmpegAvailable: registry.ffmpegAvailable,
      ffprobeAvailable: registry.ffprobeAvailable,
    });
  });

  router.post('/jobs', limit, auth, csrf, async (req, res) => {
    try {
      const userId = req.auth?.userId || req.body?.userId || null;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized', code: AUDIO_ERROR_CODES.UNAUTHORIZED });
      }
      const intent = req.body?.intent || 'analyze_audio';
      const requestedOperations = req.body?.requestedOperations || ['metadata_inspection'];
      const registry = await getCapabilityRegistry();
      const assessment = assessCapabilities(requestedOperations, registry);
      const job = createAudioJob({
        userId,
        displayName: req.body?.displayName || null,
        channel: 'web',
        conversationId: req.body?.conversationId || null,
        intent,
        requestedOperations,
        capabilityAssessment: assessment,
        targetProfile: req.body?.targetProfile || undefined,
      });
      res.status(201).json({ jobId: job.jobId, status: job.status, capabilityAssessment: assessment });
    } catch (err) {
      res.status(400).json({ error: err.message, code: err.code || AUDIO_ERROR_CODES.INVALID_INPUT });
    }
  });

  router.post('/jobs/:jobId/files', limit, auth, csrf, async (req, res) => {
    try {
      const job = readJob(req.params.jobId);
      assertJobAccess(job, req.auth?.userId);
      const { fileName, mimeType, base64, filePath } = req.body || {};
      let localPath = filePath || null;
      if (base64 && !localPath) {
        const dir = join(jobDir(job.jobId), 'original');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const name = safeFileName(fileName || 'upload.bin');
        localPath = join(dir, `upload_${Date.now()}_${name}`);
        writeFileSync(localPath, Buffer.from(base64, 'base64'));
      }
      if (!localPath || !existsSync(localPath)) {
        return res.status(400).json({
          error: userMessageForAudioError(AUDIO_ERROR_CODES.INVALID_INPUT),
          code: AUDIO_ERROR_CODES.INVALID_INPUT,
        });
      }
      const updated = storeOriginalFile(job.jobId, localPath, {
        fileName: fileName || 'upload.bin',
        mimeType: mimeType || null,
      });
      res.json({ jobId: updated.jobId, status: updated.status, sourceFile: sanitizeSource(updated.sourceFile) });
    } catch (err) {
      const status = err.code === AUDIO_ERROR_CODES.UNAUTHORIZED ? 403 : 400;
      res.status(status).json({ error: err.message, code: err.code || AUDIO_ERROR_CODES.INVALID_INPUT });
    }
  });

  router.post('/jobs/:jobId/analyze', limit, auth, csrf, async (req, res) => {
    try {
      const job = readJob(req.params.jobId);
      assertJobAccess(job, req.auth?.userId);
      if (!job.sourceFile?.localPath) {
        return res.status(400).json({ code: AUDIO_ERROR_CODES.INVALID_INPUT, error: 'No file on job' });
      }
      const registry = await getCapabilityRegistry();
      if (!registry.flags?.analysis) {
        return res.status(409).json({
          code: AUDIO_ERROR_CODES.CAPABILITY_DISABLED,
          error: userMessageForAudioError(AUDIO_ERROR_CODES.CAPABILITY_DISABLED),
        });
      }
      updateJob(job.jobId, { status: 'analyzing' });
      const report = await inspectAudioFile({
        localPath: job.sourceFile.localPath,
        fileName: job.sourceFile.fileName,
        mimeType: job.sourceFile.mimeType,
        analysisEnabled: true,
      });
      const updated = updateJob(job.jobId, {
        status: report.ok ? 'queued' : 'failed',
        analysisReport: report,
        errors: report.ok
          ? job.errors || []
          : [...(job.errors || []), ...report.errorCodes.map((c) => ({ code: c, at: new Date().toISOString() }))],
      });
      res.json({ jobId: updated.jobId, status: updated.status, analysis: publicAnalysis(report) });
    } catch (err) {
      const status = err.code === AUDIO_ERROR_CODES.UNAUTHORIZED ? 403 : 400;
      res.status(status).json({ error: err.message, code: err.code || AUDIO_ERROR_CODES.INVALID_INPUT });
    }
  });

  router.post('/jobs/:jobId/process', limit, auth, csrf, async (req, res) => {
    try {
      const job = readJob(req.params.jobId);
      assertJobAccess(job, req.auth?.userId);
      const registry = await getCapabilityRegistry();
      const assessment = assessCapabilities(job.requestedOperations || [], registry);
      const canProcess =
        registry.flags?.processing &&
        assessment.available.some((op) =>
          ['noise_reduction', 'mixing', 'mastering', 'stem_separation', 'vocal_tuning', 'add_instrumentation'].includes(op),
        );
      if (!canProcess) {
        updateJob(job.jobId, {
          status: 'unsupported',
          capabilityAssessment: assessment,
        });
        return res.status(409).json({
          code: AUDIO_ERROR_CODES.CAPABILITY_DISABLED,
          error:
            'İşleme motoru aktif değil. Analiz mümkünse analiz kullan; stüdyo üretimi için sağlayıcı gerekir.',
          capabilityAssessment: assessment,
        });
      }
      // Real providers only — refuse fake completion
      return res.status(409).json({
        code: AUDIO_ERROR_CODES.PROVIDER_NOT_CONFIGURED,
        error: userMessageForAudioError(AUDIO_ERROR_CODES.PROVIDER_NOT_CONFIGURED),
        capabilityAssessment: assessment,
      });
    } catch (err) {
      const status = err.code === AUDIO_ERROR_CODES.UNAUTHORIZED ? 403 : 400;
      res.status(status).json({ error: err.message, code: err.code || AUDIO_ERROR_CODES.INVALID_INPUT });
    }
  });

  router.get('/jobs/:jobId', auth, (req, res) => {
    try {
      const job = readJob(req.params.jobId);
      assertJobAccess(job, req.auth?.userId);
      res.json(publicJob(job));
    } catch (err) {
      const status = err.code === AUDIO_ERROR_CODES.UNAUTHORIZED ? 403 : 404;
      res.status(status).json({ error: err.message, code: err.code || AUDIO_ERROR_CODES.JOB_NOT_FOUND });
    }
  });

  router.get('/jobs/:jobId/status', auth, (req, res) => {
    try {
      const job = readJob(req.params.jobId);
      assertJobAccess(job, req.auth?.userId);
      res.json({
        jobId: job.jobId,
        status: job.status,
        updatedAt: job.updatedAt,
        errors: job.errors || [],
      });
    } catch (err) {
      const status = err.code === AUDIO_ERROR_CODES.UNAUTHORIZED ? 403 : 404;
      res.status(status).json({ error: err.message, code: err.code || AUDIO_ERROR_CODES.JOB_NOT_FOUND });
    }
  });

  router.get('/jobs/:jobId/outputs', auth, (req, res) => {
    try {
      const job = readJob(req.params.jobId);
      assertJobAccess(job, req.auth?.userId);
      res.json({
        jobId: job.jobId,
        outputs: (job.outputs || []).map((o) => ({
          version: o.version,
          kind: o.kind,
          format: o.format,
          createdAt: o.createdAt,
          // paths not exposed raw — download endpoint later
        })),
      });
    } catch (err) {
      const status = err.code === AUDIO_ERROR_CODES.UNAUTHORIZED ? 403 : 404;
      res.status(status).json({ error: err.message, code: err.code || AUDIO_ERROR_CODES.JOB_NOT_FOUND });
    }
  });

  router.post('/jobs/:jobId/cancel', auth, csrf, (req, res) => {
    try {
      const job = readJob(req.params.jobId);
      assertJobAccess(job, req.auth?.userId);
      if (['completed', 'cancelled'].includes(job.status)) {
        return res.json({ jobId: job.jobId, status: job.status });
      }
      const updated = updateJob(job.jobId, { status: 'cancelled' });
      res.json({ jobId: updated.jobId, status: updated.status });
    } catch (err) {
      const status = err.code === AUDIO_ERROR_CODES.UNAUTHORIZED ? 403 : 404;
      res.status(status).json({ error: err.message, code: err.code || AUDIO_ERROR_CODES.JOB_NOT_FOUND });
    }
  });

  router.post('/jobs/:jobId/retry', auth, csrf, async (req, res) => {
    try {
      const job = readJob(req.params.jobId);
      assertJobAccess(job, req.auth?.userId);
      const result = await runAudioStudioTurn({
        message: req.body?.message || `Retry ${job.intent || 'audio job'}`,
        history: [],
        userId: job.userId,
        displayName: job.displayName,
        channel: job.channel || 'web',
        conversationId: job.conversationId,
        media: job.sourceFile?.localPath
          ? {
              localPath: job.sourceFile.localPath,
              fileName: job.sourceFile.fileName,
              mimeType: job.sourceFile.mimeType,
              fileId: job.sourceFile.fileId,
            }
          : null,
      });
      res.json({
        jobId: job.jobId,
        handled: result.handled,
        reply: result.reply,
        data: result.data,
      });
    } catch (err) {
      const status = err.code === AUDIO_ERROR_CODES.UNAUTHORIZED ? 403 : 400;
      res.status(status).json({ error: err.message, code: err.code || AUDIO_ERROR_CODES.INVALID_INPUT });
    }
  });

  router.delete('/jobs/:jobId', auth, csrf, (req, res) => {
    try {
      const job = readJob(req.params.jobId);
      assertJobAccess(job, req.auth?.userId);
      deleteJob(job.jobId);
      res.json({ deleted: true, jobId: req.params.jobId });
    } catch (err) {
      const status = err.code === AUDIO_ERROR_CODES.UNAUTHORIZED ? 403 : 404;
      res.status(status).json({ error: err.message, code: err.code || AUDIO_ERROR_CODES.JOB_NOT_FOUND });
    }
  });

  router.get('/jobs', auth, (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ code: AUDIO_ERROR_CODES.UNAUTHORIZED, error: 'Unauthorized' });
    }
    const jobs = listJobs({ userId }).map(publicJob);
    res.json({ jobs });
  });

  return router;
}

function sanitizeSource(sourceFile) {
  if (!sourceFile) return null;
  return {
    fileName: sourceFile.fileName,
    mimeType: sourceFile.mimeType,
    size: sourceFile.size,
    duration: sourceFile.duration,
    checksum: sourceFile.checksum,
    // omit localPath from API
  };
}

function publicAnalysis(report) {
  if (!report) return null;
  return {
    ok: report.ok,
    duration: report.duration,
    codec: report.codec,
    sampleRate: report.sampleRate,
    bitDepth: report.bitDepth,
    channels: report.channels,
    channelLayout: report.channelLayout,
    bitrate: report.bitrate,
    supportedFormat: report.supportedFormat,
    errorCodes: report.errorCodes,
    notes: report.notes,
  };
}

function publicJob(job) {
  return {
    jobId: job.jobId,
    status: job.status,
    intent: job.intent,
    detectedType: job.detectedType,
    requestedOperations: job.requestedOperations,
    capabilityAssessment: job.capabilityAssessment,
    targetProfile: job.targetProfile,
    sourceFile: sanitizeSource(job.sourceFile),
    analysis: publicAnalysis(job.analysisReport),
    outputs: (job.outputs || []).map((o) => ({
      version: o.version,
      kind: o.kind,
      format: o.format,
      createdAt: o.createdAt,
    })),
    errors: job.errors || [],
    stages: job.stages || [],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export { AUDIO_JOBS_ROOT, AudioStudioError };

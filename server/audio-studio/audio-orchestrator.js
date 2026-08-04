/**
 * Audio Studio orchestrator — validates, analyzes, and only processes when capable.
 * Never transitions to "processing" unless a real processor can run.
 */

import {
  getCapabilityRegistry,
  assessCapabilities,
} from './capability-registry.js';
import { detectAudioIntent } from './audio-intent.js';
import { inspectAudioFile, formatAnalysisForUser } from './audio-metadata.js';
import {
  createAudioJob,
  updateJob,
  readJob,
  storeOriginalFile,
} from './audio-job-store.js';
import {
  buildAudioStudioReply,
  selectClarifyingQuestions,
  enforceTruthfulAudioReply,
} from './audio-response-builder.js';
import { evaluateAudioSafety, missingConsents } from './audio-safety.js';
import { recordAudioFeatureRequest } from './audio-feature-requests.js';
import {
  contextKey,
  setPendingAudioInstruction,
  getPendingAudioContext,
  clearPendingAudioContext,
  setPendingAudioFile,
} from './audio-context.js';
import { buildDefaultProcessorChain } from './processors/base.js';
import { logAudioEvent } from './audio-log.js';
import { AUDIO_ERROR_CODES } from './audio-errors.js';
import { classifyAudioMedia } from './audio-classifier.js';

/**
 * @param {{
 *   message: string,
 *   history?: { role: string, content: string }[],
 *   userId?: string|null,
 *   displayName?: string|null,
 *   channel?: string,
 *   chatId?: string|null,
 *   messageId?: string|null,
 *   conversationId?: string|null,
 *   media?: {
 *     localPath?: string|null,
 *     fileName?: string|null,
 *     mimeType?: string|null,
 *     fileId?: string|null,
 *     mediaKind?: string|null,
 *     size?: number|null,
 *     duration?: number|null,
 *   }|null,
 *   persistFeatureRequest?: boolean,
 * }} input
 */
export async function runAudioStudioTurn(input) {
  const t0 = Date.now();
  const registry = await getCapabilityRegistry();
  const key = contextKey({
    channel: input.channel,
    userId: input.userId,
    chatId: input.chatId,
    conversationId: input.conversationId,
  });
  const pending = getPendingAudioContext(key);
  const hasMedia = Boolean(input.media?.localPath || input.media?.fileId);

  const intent = detectAudioIntent(input.message, input.history || [], {
    pendingAudioIntent: pending?.kind === 'instruction',
    hasMediaAttachment: hasMedia,
    mediaKind: input.media?.mediaKind || null,
  });

  if (!intent.active && !hasMedia) {
    return { handled: false };
  }

  // Safety
  const safety = evaluateAudioSafety(input.message);
  if (safety.blocked) {
    const reply = enforceTruthfulAudioReply(
      buildAudioStudioReply({
        displayName: input.displayName,
        intent,
        registry,
        safetyBlock: safety.blocks[0],
      }),
      registry,
    );
    logAudioEvent({
      userId: input.userId,
      channel: input.channel,
      intent: intent.intent,
      status: 'blocked',
      errorCode: AUDIO_ERROR_CODES.SAFETY_BLOCKED,
      durationMs: Date.now() - t0,
    });
    return {
      handled: true,
      reply,
      intent: `audio:${intent.intent || 'safety'}`,
      engine: 'audio-studio',
      data: { safety: true, registryFlags: registry.flags },
    };
  }

  // Merge pending instruction intent if file arrived
  if (hasMedia && pending?.kind === 'instruction' && !intent.isProductionRequest) {
    intent.active = true;
    intent.intent = pending.intent || 'create_studio_version';
    intent.isProductionRequest = true;
    intent.requestedOperations = pending.requestedOperations?.length
      ? pending.requestedOperations
      : intent.requestedOperations;
    intent.confidence = Math.max(intent.confidence, 0.8);
  }

  const assessment = assessCapabilities(intent.requestedOperations || [], registry);
  const questions = selectClarifyingQuestions(intent, { hasFile: hasMedia });

  let job = null;
  let analysisReport = null;

  if (hasMedia && input.media?.localPath && registry.audioUpload?.enabled) {
    job = createAudioJob({
      userId: input.userId,
      displayName: input.displayName,
      channel: input.channel || 'unknown',
      chatId: input.chatId,
      messageId: input.messageId,
      conversationId: input.conversationId,
      intent: intent.intent,
      requestedOperations: intent.requestedOperations,
      capabilityAssessment: assessment,
      detectedType: classifyAudioMedia({
        mimeType: input.media.mimeType,
        fileName: input.media.fileName,
        mediaKind: input.media.mediaKind,
        size: input.media.size,
        userText: input.message,
        telegramVoice: input.media.mediaKind === 'voice',
      }).detectedType,
    });

    try {
      storeOriginalFile(job.jobId, input.media.localPath, {
        fileName: input.media.fileName,
        mimeType: input.media.mimeType,
        fileId: input.media.fileId,
        duration: input.media.duration,
      });
      job = readJob(job.jobId);

      if (registry.metadataInspection?.enabled || registry.flags?.analysis) {
        updateJob(job.jobId, { status: 'analyzing' });
        analysisReport = await inspectAudioFile({
          localPath: job.sourceFile?.localPath || input.media.localPath,
          fileName: input.media.fileName,
          mimeType: input.media.mimeType,
          mediaKind: input.media.mediaKind,
          userText: input.message,
          analysisEnabled: Boolean(registry.flags?.analysis),
        });
        updateJob(job.jobId, {
          status: analysisReport.ok ? 'queued' : 'failed',
          analysisReport,
          errors: analysisReport.ok
            ? []
            : (analysisReport.errorCodes || []).map((code) => ({
                code,
                at: new Date().toISOString(),
              })),
          capabilityAssessment: assessment,
        });
        job = readJob(job.jobId);
      } else {
        updateJob(job.jobId, {
          status: 'unsupported',
          capabilityAssessment: assessment,
        });
        job = readJob(job.jobId);
      }

      // Attempt processing only if something can actually run
      const chain = buildDefaultProcessorChain();
      const runnable = [];
      for (const proc of chain) {
        if (await proc.canRun({ registry, job })) runnable.push(proc);
      }

      // Exclude normalize_format-only "run" pretending to be full processing
      const realRunnable = runnable.filter((p) => p.name !== 'normalize_format');

      if (realRunnable.length > 0 && registry.flags?.processing) {
        updateJob(job.jobId, { status: 'processing' });
        const stages = [];
        for (const proc of realRunnable) {
          const validation = proc.validate({ localPath: job.sourceFile?.localPath });
          if (!validation.ok) {
            stages.push({ name: proc.name, status: 'failed', errorCode: validation.errorCode });
            continue;
          }
          const consentsMissing = missingConsents([proc.name], {
            externalConsent: job.consents?.externalUpload,
            generationConsent: job.consents?.generation,
          });
          if (consentsMissing.length) {
            stages.push({
              name: proc.name,
              status: 'blocked',
              errorCode: AUDIO_ERROR_CODES.CONSENT_REQUIRED,
            });
            continue;
          }
          const out = await proc.execute({ localPath: job.sourceFile?.localPath });
          stages.push({
            name: proc.name,
            status: out.ok ? 'completed' : 'failed',
            errorCode: out.errorCode || null,
          });
        }
        const anyOk = stages.some((s) => s.status === 'completed');
        const anyFail = stages.some((s) => s.status === 'failed' || s.status === 'blocked');
        updateJob(job.jobId, {
          stages,
          status: anyOk && anyFail ? 'partially_completed' : anyOk ? 'completed' : 'failed',
        });
        job = readJob(job.jobId);
      } else if (job.status === 'queued' || job.status === 'analyzing') {
        // Analysis done; processing unavailable — not "processing"
        updateJob(job.jobId, {
          status: analysisReport && !analysisReport.ok ? 'failed' : 'unsupported',
          stages: [{ name: 'processing', status: 'skipped', errorCode: 'CAPABILITY_DISABLED' }],
        });
        job = readJob(job.jobId);
      }

      setPendingAudioFile(key, {
        jobId: job.jobId,
        fileId: input.media.fileId,
        fileName: input.media.fileName,
        mimeType: input.media.mimeType,
        mediaKind: input.media.mediaKind,
      });
      if (pending?.kind === 'instruction') clearPendingAudioContext(key);
    } catch (err) {
      if (job?.jobId) {
        updateJob(job.jobId, {
          status: 'failed',
          errors: [
            ...(job.errors || []),
            { code: err.code || 'ENGINE_FAILURE', message: String(err.message || err), at: new Date().toISOString() },
          ],
        });
      }
      logAudioEvent({
        jobId: job?.jobId,
        userId: input.userId,
        channel: input.channel,
        intent: intent.intent,
        status: 'failed',
        errorCode: err.code || 'ENGINE_FAILURE',
        durationMs: Date.now() - t0,
      });
    }
  } else if (intent.awaitingFile || (intent.isProductionRequest && !hasMedia)) {
    setPendingAudioInstruction(key, {
      intent: intent.intent,
      message: input.message,
      requestedOperations: intent.requestedOperations,
      displayName: input.displayName,
    });
  }

  if (intent.isFeatureRequest) {
    recordAudioFeatureRequest({
      requestedBy: input.displayName,
      userId: input.userId,
      request: input.message,
      detectedCapabilities: intent.requestedOperations,
      source: input.channel || 'unknown',
      persistConsent: Boolean(input.persistFeatureRequest),
    });
  }

  let reply = buildAudioStudioReply({
    displayName: input.displayName,
    intent,
    registry,
    analysisReport,
    job,
    clarifyingQuestions: questions,
    errorCode: job?.status === 'failed' && job.errors?.[0]?.code ? job.errors[0].code : null,
  });

  if (analysisReport?.ok && hasMedia) {
    const analysisText = formatAnalysisForUser(analysisReport);
    if (analysisText && !reply.includes(analysisText.slice(0, 40))) {
      reply = `${reply}\n\n${analysisText}`;
    }
  }

  reply = enforceTruthfulAudioReply(reply, registry);

  logAudioEvent({
    jobId: job?.jobId,
    userId: input.userId,
    channel: input.channel,
    intent: intent.intent,
    mediaType: job?.detectedType || input.media?.mediaKind || null,
    status: job?.status || 'advisory',
    durationMs: Date.now() - t0,
  });

  return {
    handled: true,
    reply,
    intent: `audio:${intent.intent}`,
    engine: 'audio-studio',
    data: {
      audioStudio: true,
      jobId: job?.jobId || null,
      jobStatus: job?.status || null,
      detectedIntent: intent.intent,
      requestedOperations: intent.requestedOperations,
      capabilityAssessment: assessment,
      isFeatureRequest: intent.isFeatureRequest,
      analysis: analysisReport
        ? {
            ok: analysisReport.ok,
            duration: analysisReport.duration,
            codec: analysisReport.codec,
            channels: analysisReport.channels,
            sampleRate: analysisReport.sampleRate,
            errorCodes: analysisReport.errorCodes,
          }
        : null,
      flags: registry.flags,
      ffmpegAvailable: registry.ffmpegAvailable,
      ffprobeAvailable: registry.ffprobeAvailable,
    },
  };
}

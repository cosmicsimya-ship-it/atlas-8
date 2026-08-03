/**
 * Audio metadata inspection — ffprobe when available; graceful degradation otherwise.
 */

import { existsSync, statSync } from 'fs';
import { probeMediaFile, checkFfmpegAvailability } from './providers/local-ffmpeg.js';
import { classifyAudioMedia } from './audio-classifier.js';
import { AUDIO_ERROR_CODES } from './audio-errors.js';

export const MAX_AUDIO_BYTES = () =>
  Number(process.env.ATLAS_AUDIO_MAX_BYTES || 52_428_800); // ~50MB
export const MAX_AUDIO_DURATION_SEC = () =>
  Number(process.env.ATLAS_AUDIO_MAX_DURATION_SEC || 1800);

/**
 * Lightweight file validation before probe.
 * @param {{
 *   localPath?: string|null,
 *   fileName?: string|null,
 *   mimeType?: string|null,
 *   size?: number|null,
 *   mediaKind?: string|null,
 *   userText?: string|null,
 * }} input
 */
export function validateAudioFileBasics(input = {}) {
  const errors = [];
  const size =
    input.size != null
      ? Number(input.size)
      : input.localPath && existsSync(input.localPath)
        ? statSync(input.localPath).size
        : null;

  if (size === 0) {
    errors.push(AUDIO_ERROR_CODES.ZERO_BYTE_FILE);
  }
  if (size != null && size > MAX_AUDIO_BYTES()) {
    errors.push(AUDIO_ERROR_CODES.FILE_TOO_LARGE);
  }

  const classification = classifyAudioMedia({
    mimeType: input.mimeType,
    fileName: input.fileName,
    mediaKind: input.mediaKind,
    size,
    userText: input.userText,
  });

  if (classification.mimeExtMismatch) {
    errors.push(AUDIO_ERROR_CODES.MIME_MISMATCH);
  }
  if (!classification.supported && classification.detectedType !== 'unknown_audio') {
    if (classification.detectedType === 'video_with_audio') {
      // video extract may be planned — still flag unsupported for processing v1
      errors.push(AUDIO_ERROR_CODES.FORMAT_UNSUPPORTED);
    } else if (classification.detectedType === 'midi' || classification.detectedType === 'daw_project') {
      errors.push(AUDIO_ERROR_CODES.FORMAT_UNSUPPORTED);
    } else if (classification.detectedType === 'unsupported_media') {
      errors.push(AUDIO_ERROR_CODES.FORMAT_UNSUPPORTED);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    size,
    classification,
  };
}

/**
 * Full inspection when analysis is enabled.
 * @param {{
 *   localPath: string,
 *   fileName?: string|null,
 *   mimeType?: string|null,
 *   mediaKind?: string|null,
 *   userText?: string|null,
 *   analysisEnabled?: boolean,
 * }} input
 */
export async function inspectAudioFile(input) {
  const basics = validateAudioFileBasics(input);
  const report = {
    ok: basics.ok,
    errorCodes: [...basics.errors],
    classification: basics.classification,
    size: basics.size,
    duration: null,
    codec: null,
    sampleRate: null,
    bitDepth: null,
    channels: null,
    channelLayout: null,
    bitrate: null,
    peakLevel: null,
    rmsEstimate: null,
    lufsEstimate: null,
    clippingSuspected: null,
    lowLevelSuspected: null,
    silenceRatio: null,
    noiseFloorEstimate: null,
    dynamicRangeEstimate: null,
    fileCorrupt: false,
    supportedFormat: basics.classification.supported,
    provider: null,
    notes: /** @type {string[]} */ ([]),
  };

  if (!input.analysisEnabled) {
    report.notes.push('analysis_disabled');
    return report;
  }

  if (!input.localPath || !existsSync(input.localPath)) {
    report.ok = false;
    report.errorCodes.push(AUDIO_ERROR_CODES.FILE_CORRUPT);
    report.fileCorrupt = true;
    return report;
  }

  const avail = await checkFfmpegAvailability();
  if (!avail.ffprobeAvailable) {
    report.notes.push('ffprobe_unavailable');
    report.errorCodes.push(AUDIO_ERROR_CODES.FFPROBE_NOT_FOUND);
    // Soft: basics may still be ok; analysis limited
    return report;
  }

  const probed = await probeMediaFile(input.localPath, { ffprobePath: avail.ffprobePath });
  if (!probed.ok) {
    report.ok = false;
    report.errorCodes.push(probed.errorCode || AUDIO_ERROR_CODES.FILE_CORRUPT);
    report.fileCorrupt = probed.errorCode === AUDIO_ERROR_CODES.FILE_CORRUPT;
    return report;
  }

  report.provider = 'ffprobe';
  const m = probed.metadata;
  report.duration = m.duration;
  report.codec = m.codec;
  report.sampleRate = m.sampleRate;
  report.bitDepth = m.bitDepth;
  report.channels = m.channels;
  report.channelLayout = m.channelLayout;
  report.bitrate = m.bitrate;
  if (m.size) report.size = m.size;

  if (report.duration != null && report.duration > MAX_AUDIO_DURATION_SEC()) {
    report.ok = false;
    report.errorCodes.push(AUDIO_ERROR_CODES.DURATION_TOO_LONG);
  }

  // Without full sample decode we cannot claim peak/LUFS — leave null honestly
  report.notes.push('loudness_metrics_require_decode_pass');

  return report;
}

/**
 * Build a user-facing analysis summary (not a raw dump).
 * @param {Awaited<ReturnType<typeof inspectAudioFile>>} report
 */
export function formatAnalysisForUser(report) {
  if (!report) return '';
  const parts = [];

  if (report.errorCodes?.includes(AUDIO_ERROR_CODES.FILE_CORRUPT)) {
    return 'Dosyayı teknik olarak okuyamadım; bozuk veya desteklenmeyen bir codec olabilir.';
  }

  if (report.duration != null) {
    const sec = Math.round(report.duration);
    parts.push(`Süre yaklaşık ${sec} saniye`);
  }
  if (report.channels != null) {
    parts.push(report.channels === 1 ? 'mono' : report.channels === 2 ? 'stereo' : `${report.channels} kanal`);
  }
  if (report.sampleRate) parts.push(`${Math.round(report.sampleRate / 1000)} kHz örnekleme`);
  if (report.codec) parts.push(`codec: ${report.codec}`);

  if (report.classification?.detectedType === 'vocal_and_instrument_mix') {
    parts.push(
      'Vokal ile enstrüman aynı kayıtta görünüyor; ikisini tamamen bağımsız düzenlemek sınırlı olabilir',
    );
  }

  if (!report.provider) {
    parts.push('Derin seviye/LUFS analizi için ffprobe şu an kullanılamıyor veya henüz çalıştırılmadı');
  }

  if (parts.length === 0) {
    return 'Dosyayı aldım; ayrıntılı teknik metrikler şu an çıkarılamadı.';
  }

  return `Kaydın teknik özeti: ${parts.join('; ')}.`;
}

/**
 * Local FFmpeg / ffprobe provider adapter.
 * Analysis-only in v1 — never invents processing capacity.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';

const PROBE_TIMEOUT_MS = 8_000;

/**
 * @param {string} bin
 * @param {string[]} args
 * @param {number} [timeoutMs]
 * @returns {Promise<{ ok: boolean, stdout: string, stderr: string, code: number|null }>}
 */
export function runBinary(bin, args, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let child;
    try {
      child = spawn(bin, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      finish({
        ok: false,
        stdout: '',
        stderr: err?.message || String(err),
        code: null,
      });
      return;
    }

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      finish({ ok: false, stdout, stderr: stderr || 'timeout', code: null });
    }, timeoutMs);

    child.stdout?.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr?.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      finish({
        ok: false,
        stdout,
        stderr: err?.message || String(err),
        code: null,
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ ok: code === 0, stdout, stderr, code });
    });
  });
}

let _availabilityCache = null;
let _availabilityAt = 0;
const AVAIL_TTL_MS = 60_000;

/**
 * @param {{ force?: boolean }} [opts]
 */
export async function checkFfmpegAvailability(opts = {}) {
  const now = Date.now();
  if (!opts.force && _availabilityCache && now - _availabilityAt < AVAIL_TTL_MS) {
    return _availabilityCache;
  }

  const ffmpegBin = process.env.ATLAS_FFMPEG_PATH || 'ffmpeg';
  const ffprobeBin = process.env.ATLAS_FFPROBE_PATH || 'ffprobe';

  const [ffmpegRes, ffprobeRes] = await Promise.all([
    runBinary(ffmpegBin, ['-version'], 5_000),
    runBinary(ffprobeBin, ['-version'], 5_000),
  ]);

  _availabilityCache = {
    ffmpegAvailable: Boolean(ffmpegRes.ok),
    ffprobeAvailable: Boolean(ffprobeRes.ok),
    ffmpegPath: ffmpegBin,
    ffprobePath: ffprobeBin,
  };
  _availabilityAt = now;
  return _availabilityCache;
}

export function _resetFfmpegAvailabilityCache() {
  _availabilityCache = null;
  _availabilityAt = 0;
}

/**
 * Provider descriptor for registry / health.
 */
export function getLocalFfmpegProviderDescriptor(availability) {
  const avail = availability || {
    ffmpegAvailable: false,
    ffprobeAvailable: false,
  };
  return {
    id: 'local_ffmpeg',
    enabled: true,
    configured: avail.ffmpegAvailable || avail.ffprobeAvailable,
    apiKeyPresent: false,
    supportedOperations: ['metadata_inspection', 'normalize_format', 'export'],
    supportedFormats: ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac'],
    maxFileSize: Number(process.env.ATLAS_AUDIO_MAX_BYTES || 52_428_800),
    maxDuration: Number(process.env.ATLAS_AUDIO_MAX_DURATION_SEC || 1800),
    timeout: PROBE_TIMEOUT_MS,
    privacyPolicyLabel: 'local_only',
    costEstimateMode: 'none',
    healthCheck: async () => checkFfmpegAvailability({ force: true }),
  };
}

/**
 * Probe a media file with ffprobe. Returns structured metadata or error code.
 * @param {string} filePath
 * @param {{ ffprobePath?: string }} [opts]
 */
export async function probeMediaFile(filePath, opts = {}) {
  if (!filePath || !existsSync(filePath)) {
    return { ok: false, errorCode: 'FILE_CORRUPT', metadata: null };
  }

  const bin = opts.ffprobePath || process.env.ATLAS_FFPROBE_PATH || 'ffprobe';
  const args = [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  const result = await runBinary(bin, args, 20_000);
  if (!result.ok) {
    if (/not found|ENOENT|is not recognized/i.test(result.stderr)) {
      return { ok: false, errorCode: 'FFPROBE_NOT_FOUND', metadata: null };
    }
    return { ok: false, errorCode: 'FILE_CORRUPT', metadata: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return { ok: false, errorCode: 'FILE_CORRUPT', metadata: null };
  }

  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const audioStream = streams.find((s) => s.codec_type === 'audio') || null;
  const format = parsed.format || {};

  if (!audioStream) {
    return { ok: false, errorCode: 'NO_AUDIO_STREAM', metadata: null };
  }

  const duration = Number(format.duration || audioStream.duration || 0) || null;
  const bitRate = Number(format.bit_rate || audioStream.bit_rate || 0) || null;
  const sampleRate = Number(audioStream.sample_rate || 0) || null;
  const channels = Number(audioStream.channels || 0) || null;
  const bitDepth =
    Number(audioStream.bits_per_raw_sample || audioStream.bits_per_sample || 0) || null;

  return {
    ok: true,
    errorCode: null,
    metadata: {
      duration,
      codec: audioStream.codec_name || null,
      sampleRate,
      bitDepth,
      channels,
      channelLayout: audioStream.channel_layout || (channels === 1 ? 'mono' : channels === 2 ? 'stereo' : null),
      bitrate: bitRate,
      formatName: format.format_name || null,
      size: Number(format.size || 0) || null,
      raw: undefined,
    },
  };
}

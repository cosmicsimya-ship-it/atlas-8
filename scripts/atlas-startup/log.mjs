import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { LOG_ROTATION, PATHS } from './config.mjs';
import { getProjectRoot } from './paths.mjs';

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{10,}\b/g,
  /\b\d{8,10}:[A-Za-z0-9_-]{20,}\b/g,
  /(OPENAI_API_KEY|TELEGRAM_BOT_TOKEN|API_KEY|SECRET|TOKEN)\s*=\s*[^\s]+/gi,
];

export function redactSecrets(text) {
  let out = String(text ?? '');
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

function ensureLogDir(root = getProjectRoot()) {
  const dir = join(root, PATHS.logDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function rotateIfNeeded(logPath) {
  if (!existsSync(logPath)) return;
  const size = statSync(logPath).size;
  if (size < LOG_ROTATION.maxBytes) return;

  const dir = dirname(logPath);
  const base = 'atlas-startup.log';
  for (let i = LOG_ROTATION.maxFiles - 1; i >= 1; i -= 1) {
    const from = join(dir, `${base}.${i}`);
    const to = join(dir, `${base}.${i + 1}`);
    if (existsSync(from)) {
      if (i === LOG_ROTATION.maxFiles - 1 && existsSync(to)) unlinkSync(to);
      renameSync(from, to);
    }
  }
  renameSync(logPath, join(dir, `${base}.1`));
}

export function writeLog(message, { root = getProjectRoot(), level = 'info' } = {}) {
  ensureLogDir(root);
  const logPath = join(root, PATHS.logFile);
  rotateIfNeeded(logPath);
  const line = `[${new Date().toISOString()}] [${level}] ${redactSecrets(message)}\n`;
  appendFileSync(logPath, line, 'utf8');
  return logPath;
}

export function getLogPath(root = getProjectRoot()) {
  return join(root, PATHS.logFile);
}

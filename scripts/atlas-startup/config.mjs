import { join } from 'path';

export const TASK_NAME = 'AtlasStartupManager';
export const STARTUP_COMMAND = 'npm run atlas:start';

export const SERVICES = {
  backend: {
    key: 'backend',
    label: 'Backend',
    port: Number(process.env.PORT) || 3001,
    pidFile: 'atlas-backend.pid',
    scriptArgs: ['server/index.js'],
    healthUrl: (port) => `http://127.0.0.1:${port}/api/ai/health`,
    healthTimeoutMs: 30_000,
    startTimeoutMs: 20_000,
  },
  frontend: {
    key: 'frontend',
    label: 'Frontend',
    port: Number(process.env.VITE_PORT) || 5173,
    pidFile: 'atlas-frontend.pid',
    // Prefer node+vite on Windows — npm.cmd + detached spawn is unreliable (EINVAL / early exit).
    scriptArgs: ['node_modules/vite/bin/vite.js'],
    healthUrl: (port) => `http://127.0.0.1:${port}/`,
    healthTimeoutMs: 45_000,
    startTimeoutMs: 40_000,
  },
  telegram: {
    key: 'telegram',
    label: 'Telegram',
    pidFile: 'atlas-telegram.pid',
    pollLockFile: 'telegram.poll.lock',
    scriptArgs: ['server/telegram.js'],
    logFile: join('data', 'logs', 'atlas-telegram.log'),
    requiresEnv: 'TELEGRAM_BOT_TOKEN',
    startTimeoutMs: 20_000,
    readinessObservationMs: 10_000,
    readinessPollMs: 250,
  },
};

export const PATHS = {
  startupLock: 'atlas.startup.lock',
  logDir: join('data', 'logs', 'atlas-startup'),
  logFile: join('data', 'logs', 'atlas-startup', 'atlas-startup.log'),
};

export const LOG_ROTATION = {
  maxBytes: 2 * 1024 * 1024,
  maxFiles: 3,
};

export const STARTUP_LOCK_STALE_MS = 10 * 60 * 1000;

export const WINDOWS_TASK_RESULT_CODES = {
  0: 'success',
  267009: 'task is running',
  267011: 'task disabled',
  267014: 'task has not run yet',
  267015: 'no more runs scheduled',
  2147946720: 'operation failed (0x80070000)',
  2147942405: 'access denied',
  1: 'general error',
};

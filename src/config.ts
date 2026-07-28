export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3001';

export const REQUEST_TIMEOUT_MS = 120_000;

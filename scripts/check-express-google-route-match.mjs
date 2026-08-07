/**
 * Check whether Express 5 matches /api/auth/google against /api/auth/google/status
 */
import express from 'express';
import { createServer } from 'http';

const app = express();
const hits = [];

app.get('/api/auth/google/status', (_req, res) => {
  hits.push('status');
  res.json({ route: 'status' });
});
app.get('/api/auth/google', (_req, res) => {
  hits.push('google');
  res.json({ route: 'google' });
});
app.get('/api/auth/google/callback', (_req, res) => {
  hits.push('callback');
  res.json({ route: 'callback' });
});

const server = createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

for (const p of [
  '/api/auth/google/status',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/google/status/',
]) {
  hits.length = 0;
  const res = await fetch(`${base}${p}`);
  const text = await res.text();
  console.log(p, '=>', res.status, text, 'hits=', [...hits]);
}

server.close();
console.log('express', (await import('express')).default?.version || 'unknown');

/**
 * Simulate LiteSpeed lsnode.js loading server/index.js via require().
 * Fails if the ESM graph contains top-level await (ERR_REQUIRE_ASYNC_MODULE).
 */
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.env.ATLAS_NO_LISTEN = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.ATLAS_SERVE_FRONTEND = process.env.ATLAS_SERVE_FRONTEND || '0';

const require = createRequire(join(root, 'package.json'));
const entry = join(root, 'server', 'index.js');

try {
  require(entry);
  console.log('[check-lsnode-require] OK', entry);
} catch (err) {
  console.error('[check-lsnode-require] FAIL', err?.code || '', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
}

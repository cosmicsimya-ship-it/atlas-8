#!/bin/bash
set -e
APP=~/public_html/ATLAS
echo "=== APP ==="
ls -la "$APP/server/auth" 2>&1 | head -40
echo "=== HAS google-oauth-http? ==="
ls -la "$APP/server/auth/google-oauth-http.js" 2>&1 || true
echo "=== index oauth mounts ==="
rg -n "mountGoogleOAuthRoutes|/api/auth/google|/api/auth/oauth|mountSeoRoutes|seo/index" "$APP/server/index.js" 2>/dev/null | head -40 || grep -nE "mountGoogleOAuthRoutes|/api/auth/google|/api/auth/oauth|mountSeoRoutes|seo/index" "$APP/server/index.js" | head -40
echo "=== STDERR CANDIDATES ==="
for f in \
  "$APP/stderr.log" \
  "$APP/logs/stderr.log" \
  "$HOME/logs/stderr.log" \
  "$HOME/ssl/ssl.error.log" \
  ; do
  if [ -f "$f" ]; then echo "-- $f"; ls -la "$f"; tail -n 60 "$f"; echo; fi
done
find "$APP" -maxdepth 3 \( -name '*stderr*' -o -name 'error_log' -o -name '*.log' \) 2>/dev/null | head -50
echo "=== PASSENGER / RESTART ==="
ls -la "$APP/tmp" 2>&1 | head -20
echo "=== AUTH IMPORT ==="
cd "$APP"
node --input-type=module <<'NODE'
try {
  const m = await import('./server/auth/index.js');
  const keys = Object.keys(m).filter((k) => /google|oauth|OAuth|Redirect|mount/i.test(k));
  console.log('AUTH_OK', keys);
  if (typeof m.getGoogleOAuthPublicStatus === 'function') {
    console.log('STATUS', m.getGoogleOAuthPublicStatus());
  }
} catch (e) {
  console.error('AUTH_IMPORT_FAIL');
  console.error(e && e.stack ? e.stack : e);
}
NODE
echo "=== SERVER INDEX IMPORT (ATLAS_NO_LISTEN) ==="
ATLAS_NO_LISTEN=1 NODE_ENV=production node --input-type=module <<'NODE'
try {
  const m = await import('./server/index.js');
  console.log('INDEX_OK', typeof m.app);
} catch (e) {
  console.error('INDEX_IMPORT_FAIL');
  console.error(e && e.stack ? e.stack : e);
  process.exitCode = 1;
}
NODE

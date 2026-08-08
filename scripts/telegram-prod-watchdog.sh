#!/usr/bin/env bash
# Atlas Telegram production watchdog — exactly one poller; never starts server/index.js.
# Intended for cron (every 1–2 min) and @reboot on Namecheap/cPanel shared hosting.
set -euo pipefail

ROOT="${ATLAS_ROOT:-$HOME/public_html/ATLAS}"
cd "$ROOT"

PID_FILE="$ROOT/data/atlas-telegram.pid"
LOCK_FILE="$ROOT/data/telegram.poll.lock"
LOG_DIR="$ROOT/data/logs"
OUT_LOG="$LOG_DIR/telegram.out.log"
ERR_LOG="$LOG_DIR/telegram.err.log"
WATCH_LOG="$LOG_DIR/telegram-watchdog.log"

NODE_BIN="${ATLAS_NODE_BIN:-}"
if [ -z "$NODE_BIN" ]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
  elif [ -x /opt/alt/alt-nodejs24/root/usr/bin/node ]; then
    NODE_BIN=/opt/alt/alt-nodejs24/root/usr/bin/node
  elif [ -x /opt/alt/alt-nodejs22/root/usr/bin/node ]; then
    NODE_BIN=/opt/alt/alt-nodejs22/root/usr/bin/node
  fi
fi

mkdir -p "$LOG_DIR" "$ROOT/data" "$ROOT/tmp"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { echo "$(ts) $*" >> "$WATCH_LOG"; }

is_alive_telegram_pid() {
  local pid="$1"
  [ -n "$pid" ] && [ "$pid" -gt 0 ] 2>/dev/null || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  if [ -r "/proc/$pid/cmdline" ]; then
    tr '\0' ' ' < "/proc/$pid/cmdline" | grep -q 'server/telegram.js'
    return $?
  fi
  return 0
}

list_telegram_pids() {
  pgrep -f '[n]ode .*server/telegram\.js' 2>/dev/null || true
}

count_telegram() {
  list_telegram_pids | sed '/^$/d' | wc -l | tr -d ' '
}

TG_COUNT="$(count_telegram)"

if [ "${TG_COUNT}" -gt 1 ]; then
  log "WARN duplicate telegram processes count=${TG_COUNT}; trimming to one"
  KEEP=""
  for p in $(list_telegram_pids); do
    if [ -z "$KEEP" ]; then
      KEEP="$p"
      continue
    fi
    log "STOP duplicate pid=$p"
    kill "$p" 2>/dev/null || true
  done
  sleep 1
  if [ -n "$KEEP" ]; then
    echo "$KEEP" > "$PID_FILE"
    log "KEPT pid=$KEEP"
  fi
  exit 0
fi

if [ "${TG_COUNT}" -eq 1 ]; then
  PID="$(list_telegram_pids | head -1)"
  echo "$PID" > "$PID_FILE"
  exit 0
fi

if [ -f "$LOCK_FILE" ]; then
  OWNER="$(tr -d '[:space:]' < "$LOCK_FILE" || true)"
  if ! is_alive_telegram_pid "${OWNER:-0}"; then
    rm -f "$LOCK_FILE"
    log "Removed stale poll lock owner=${OWNER:-unknown}"
  fi
fi

if [ -z "${NODE_BIN}" ] || [ ! -x "${NODE_BIN}" ]; then
  log "ERROR node binary not found"
  exit 1
fi

if ! grep -qE '^TELEGRAM_BOT_TOKEN=.+' .env 2>/dev/null; then
  log "ERROR TELEGRAM_BOT_TOKEN missing in .env"
  exit 1
fi
if ! grep -qE '^ATLAS_INTERNAL_BOT_SECRET=.+' .env 2>/dev/null; then
  log "ERROR ATLAS_INTERNAL_BOT_SECRET missing in .env"
  exit 1
fi
if ! grep -qE '^BACKEND_URL=.+' .env 2>/dev/null; then
  log "ERROR BACKEND_URL missing in .env"
  exit 1
fi

log "START telegram via ${NODE_BIN}"
nohup "$NODE_BIN" server/telegram.js >>"$OUT_LOG" 2>>"$ERR_LOG" </dev/null &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"
disown "$NEW_PID" 2>/dev/null || true
sleep 2

if is_alive_telegram_pid "$NEW_PID"; then
  log "STARTED pid=$NEW_PID"
  exit 0
fi

TG_COUNT="$(count_telegram)"
if [ "${TG_COUNT}" -eq 1 ]; then
  PID="$(list_telegram_pids | head -1)"
  echo "$PID" > "$PID_FILE"
  log "STARTED pid=$PID (observed)"
  exit 0
fi

log "ERROR telegram failed to stay up"
tail -n 40 "$ERR_LOG" >> "$WATCH_LOG" 2>/dev/null || true
exit 1

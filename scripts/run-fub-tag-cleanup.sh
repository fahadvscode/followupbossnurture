#!/bin/bash
# Resumable FUB tag cleanup for Mac Mini.
# Shows live progress in Terminal AND writes to the log.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p exports
LOG="exports/fub-tag-cleanup.log"
STATE="exports/fub-tag-cleanup-state.json"
PIDFILE="exports/fub-tag-cleanup.pid"

echo $$ > "$PIDFILE"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] wrapper start pid=$$" | tee -a "$LOG"

# Prevent idle sleep while this wrapper runs
caffeinate -dims &
CAFFEINE_PID=$!
trap 'kill $CAFFEINE_PID 2>/dev/null || true' EXIT

while true; do
  if [[ -f "$STATE" ]] && grep -q '"finishedAt"' "$STATE" 2>/dev/null; then
    FINISHED=$(node -e "try{const s=require('./$STATE'); if(s.finishedAt){console.log(s.finishedAt)} }catch(e){}")
    if [[ -n "${FINISHED:-}" ]]; then
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] already finished at $FINISHED" | tee -a "$LOG"
      exit 0
    fi
  fi

  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] launching cleanup script..." | tee -a "$LOG"
  echo "Live progress will print below. Also: ./scripts/fub-tag-cleanup-status.sh" | tee -a "$LOG"

  set +e
  # tee = show in Terminal + append to log
  npx --yes tsx scripts/cleanup-fub-tags-to-keep.ts 2>&1 | tee -a "$LOG"
  CODE=${PIPESTATUS[0]}
  set -e

  if [[ -f "$STATE" ]] && node -e "const s=require('./$STATE'); process.exit(s.finishedAt?0:1)"; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] cleanup finished successfully" | tee -a "$LOG"
    exit 0
  fi

  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] script exited code=$CODE — restarting in 30s (resume from state)" | tee -a "$LOG"
  sleep 30
done

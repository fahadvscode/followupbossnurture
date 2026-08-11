#!/bin/bash
# Print real cleanup progress from saved state / progress file
cd "$(dirname "$0")/.."
if [[ -f exports/fub-tag-cleanup-progress.txt ]]; then
  cat exports/fub-tag-cleanup-progress.txt
elif [[ -f exports/fub-tag-cleanup-state.json ]]; then
  node -e "
    const s=require('./exports/fub-tag-cleanup-state.json');
    const total=s.totalPeople;
    const pct=total?Math.min(100, Math.round((s.scanned/total)*10000)/100):null;
    console.log('percent=' + (pct==null?'unknown':pct.toFixed(2)));
    console.log('scanned=' + s.scanned + (total?(' / '+total):''));
    console.log('updated=' + s.updated);
    console.log('errors=' + s.errors);
    console.log('finished=' + (s.finishedAt?'yes':'no'));
  "
else
  echo "No progress yet — start ./scripts/run-fub-tag-cleanup.sh first"
fi

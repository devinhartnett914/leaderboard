#!/bin/bash
# Daily swim-results poll (Phase 2). Compiles the swim modules, then imports any
# new Glade meet PDFs from Gmail into Supabase and reports near-miss names.
#
# Self-locating: runs against whichever checkout this script lives in (worktree
# or main), so it keeps working after feat/scraping merges to main.
#
# Scheduled by com.trime.swim-poll.plist (a launchd LaunchAgent). Run by hand any
# time with:  scripts/swim-poll.sh        (or DRY=1 scripts/swim-poll.sh to preview)
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"   # launchd starts with a bare PATH
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

# Only scan recent email so the daily run is cheap; the idempotent ingest makes a
# re-import of an already-saved meet a no-op, so a generous window is safe.
export SWIM_SINCE_DAYS="${SWIM_SINCE_DAYS:-21}"

echo "===== swim-poll $(date '+%Y-%m-%d %H:%M:%S')  repo=$REPO  since=${SWIM_SINCE_DAYS}d ====="

# Compile the TS swim modules the importer require()s into CommonJS.
node_modules/.bin/tsc --rootDir src/lib --outDir /tmp/swimsave --module commonjs \
  --target es2022 --moduleResolution node --skipLibCheck \
  src/lib/swim/hytek.ts src/lib/swim/match.ts src/lib/swim/ingest.ts src/lib/util.ts

MODE="live"; [ "${DRY:-0}" = "1" ] && MODE="dry"
node scripts/swim-backfill.cjs "$MODE"
echo "===== swim-poll done ====="

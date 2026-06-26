#!/bin/bash
# Smart 10-minute GATE for Leaderboard dispatch/release.
#
# Runs every 10 min (via com.leaderboard.dispatch.plist). It cheaply asks Linear
# "are there Todo issues, or a newly-Done issue?" with a plain GraphQL call — NO Claude,
# essentially free. Only when there's real work does it hand off to dispatch-cron.sh
# (the full headless Claude release+dispatch pass). This gives ~10-min responsiveness at
# near-zero usage, since the queue is empty the vast majority of the time.
#
# Fires the full pass when EITHER:
#   * there is >=1 issue in Todo (state type "unstarted")  -> build work, or
#   * the most-recent Done issue is newer than our watermark -> release work (merge to main).
#
# A mkdir-lock guarantees two passes never overlap (a dispatch run can take >10 min).
#
# Requires a Linear personal API key at ~/.config/leaderboard/linear-api.key (chmod 600).
# If that file is missing the gate logs and exits cleanly (safe before setup).
set -uo pipefail

export PATH="/Users/clawdnett/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="${HOME:-/Users/clawdnett}"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$HOME/Library/Logs/leaderboard-dispatch.log"
KEYFILE="$HOME/.config/leaderboard/linear-api.key"
WATERMARK="$HOME/.config/leaderboard/dispatch-done.watermark"
LOCKDIR="/tmp/leaderboard-dispatch.lock.d"
PROJECT_ID="b0a0fa85-2889-4217-b62a-51bb00d5e1dc"   # Linear "Leaderboard" project

ts() { date '+%Y-%m-%d %H:%M:%S'; }
note() { echo "[$(ts)] gate: $*" >>"$LOG"; }

# --- key present? (safe no-op before setup) ---
if [ ! -f "$KEYFILE" ]; then
  note "no Linear API key at $KEYFILE — skipping (run setup first)"
  exit 0
fi

# --- single-flight lock (macOS has no flock; mkdir is atomic). Reclaim if stale >3h. ---
if [ -d "$LOCKDIR" ] && find "$LOCKDIR" -maxdepth 0 -mmin +180 | grep -q .; then
  note "stale lock (>3h) — reclaiming"
  rmdir "$LOCKDIR" 2>/dev/null || true
fi
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  note "a dispatch pass is already running — skip"
  exit 0
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null' EXIT

# --- cheap Linear probe: Todo count + newest Done completedAt ---
probe="$(LINEAR_KEYFILE="$KEYFILE" PROJECT_ID="$PROJECT_ID" python3 - <<'PY'
import json, os, sys, urllib.request
try:
    key = open(os.path.expanduser(os.environ["LINEAR_KEYFILE"])).read().strip()
    pid = os.environ["PROJECT_ID"]
    q = ('query($pid:ID!){'
         ' todo: issues(filter:{project:{id:{eq:$pid}}, state:{type:{eq:"unstarted"}}}){nodes{id}}'
         ' done: issues(filter:{project:{id:{eq:$pid}}, state:{type:{eq:"completed"}}}){nodes{completedAt}}'
         '}')
    body = json.dumps({"query": q, "variables": {"pid": pid}}).encode()
    req = urllib.request.Request("https://api.linear.app/graphql", data=body,
        headers={"Authorization": key, "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=20))["data"]
    todo = len(d["todo"]["nodes"])
    dones = [n["completedAt"] for n in d["done"]["nodes"] if n.get("completedAt")]
    print(todo, max(dones) if dones else "-")
except Exception as e:
    print("ERR", str(e).replace("\n", " "))
    sys.exit(2)
PY
)" || { note "Linear probe failed: $probe"; exit 0; }

read -r TODO MAXDONE <<<"$probe"

# --- watermark: have we already acted on this newest Done? ---
LASTDONE="$(cat "$WATERMARK" 2>/dev/null || echo '-')"
done_trigger=0
[ "$MAXDONE" != "-" ] && [ "$MAXDONE" \> "$LASTDONE" ] && done_trigger=1

if [ "${TODO:-0}" -eq 0 ] && [ "$done_trigger" -eq 0 ]; then
  note "nothing to do (todo=$TODO, newest_done=$MAXDONE, watermark=$LASTDONE) — idle"
  exit 0
fi

note "WORK FOUND (todo=$TODO, newest_done=$MAXDONE, watermark=$LASTDONE) — launching full pass"

# --- hand off to the full headless Claude release+dispatch pass ---
bash "$REPO/scripts/dispatch-cron.sh"
rc=$?

# Only advance the Done watermark on a clean run, so a failed release retries next tick.
if [ "$rc" -eq 0 ] && [ "$MAXDONE" != "-" ]; then
  mkdir -p "$(dirname "$WATERMARK")"
  printf '%s\n' "$MAXDONE" >"$WATERMARK"
fi

note "full pass done (exit=$rc)"
exit 0

#!/bin/bash
# Daily unattended dispatch + release for Leaderboard.
#
#   Pass 1 (RELEASE): batch-merge every cleanly-mergeable Linear "Done" issue branch
#                     into main and push ONCE (>=1 Done => at most one deploy).
#   Pass 2 (DISPATCH): run the /dispatch skill over the Linear "Todo" queue, each issue
#                     on its own branch off main (pushed), left at Ready for Review.
#
# Runs a HEADLESS Claude on the mini, which has the local `linear` MCP + the /dispatch
# skill + git push creds — the things the old claude.ai cloud routine could not see.
# Scheduled by com.leaderboard.dispatch.plist (a launchd LaunchAgent).
#
# Run by hand:   scripts/dispatch-cron.sh
# Dry preview:   DISPATCH_DRY=1 scripts/dispatch-cron.sh   (release detect-only, no push, no dispatch)
#
# Safety: invoked with --dangerously-skip-permissions so tools run unattended, but the
# deny-list in ~/.claude/settings.json still hard-blocks rm -rf / reset --hard / force-push /
# branch -D even in this mode. The release pass itself never force-pushes and gates on a
# clean `npm run build` before its single push to main.
set -uo pipefail

# launchd starts with a bare PATH — add the claude bin, homebrew (node/npm), and system dirs.
export PATH="/Users/clawdnett/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="${HOME:-/Users/clawdnett}"

# Self-locating: run against whichever checkout this script lives in.
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

PROMPT_FILE="$REPO/scripts/dispatch-cron-prompt.md"
MODE="live"; [ "${DISPATCH_DRY:-0}" = "1" ] && MODE="dry"

echo "===== dispatch-cron $(date '+%Y-%m-%d %H:%M:%S')  repo=$REPO  mode=$MODE ====="

if [ ! -f "$PROMPT_FILE" ]; then
  echo "FATAL: prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

# Call the binary by ABSOLUTE PATH so the interactive .zshrc `claude` wrapper never applies.
# DISPATCH_DRY is exported above, so the headless run sees it and self-limits to detect-only.
/Users/clawdnett/.local/bin/claude -p "$(cat "$PROMPT_FILE")" \
  --dangerously-skip-permissions \
  --output-format text
rc=$?

echo "===== dispatch-cron done $(date '+%Y-%m-%d %H:%M:%S')  claude_exit=$rc ====="
exit "$rc"

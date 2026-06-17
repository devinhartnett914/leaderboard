# Swim results — Gmail importer + daily poll

`swim-backfill.cjs` downloads Glade meet-results PDFs from Gmail and imports the
family's swims into Supabase. Proven on the full 2024–2026 archive (9 meets, 47
results). `swim-poll.sh` wraps it as the **daily auto-importer (Phase 2)**, run by
a launchd LaunchAgent.

## One-time setup (Mac mini)
1. `.env` must have: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`
   (scope `gmail.readonly`), `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
2. PDF tools: `brew install poppler` (gives `pdftotext` / `pdfinfo`).
3. Compile the swim modules the script `require()`s into CommonJS:
   ```
   node_modules/.bin/tsc --rootDir src/lib --outDir /tmp/swimsave --module commonjs \
     --target es2022 --moduleResolution node --skipLibCheck \
     src/lib/swim/hytek.ts src/lib/swim/match.ts src/lib/swim/ingest.ts src/lib/util.ts
   ```

## Run
- **Daily poll** (compiles modules, imports new meets, reports near-misses):
  `scripts/swim-poll.sh`   — preview with `DRY=1 scripts/swim-poll.sh`
- Backfill the whole archive (no date window): `node scripts/swim-backfill.cjs live`
- Preview only (no DB writes): `node scripts/swim-backfill.cjs dry`

Credentials are read from `/Users/clawdnett/Projects/leaderboard/.env` (Supabase URL +
service-role key, Gmail OAuth) — no need to export them on the command line.
`SWIM_SINCE_DAYS=N` limits the Gmail scan to the last N days; the poll defaults to 21.

## How it works
- Lists the Glade Gmail label `Label_1841246710523545099`, keeps team-sender
  (`rstagd@teamunify`/`rstagd@gomotionapp`) **result** PDFs (skips meet
  programs / psych sheets / entry lists by filename + pre-meet emails by subject).
- For each PDF, `pdftotext` is run BOTH full-width and per-page left/right
  de-columned; both are parsed and the read with more entries wins — handles
  single-column (full team name, Seed+Finals) and two-column (abbrev code,
  finals-only) HY-TEK layouts without a fragile heuristic. Includes an f-ligature
  fix ("Butterfly" → "Butter ly").
- Deterministic parser (`src/lib/swim/hytek.ts`) → roster match → idempotent ingest.

## Daily schedule (launchd)
The poll runs on the **Mac mini** (not Netlify) because it needs `pdftotext`.
Install / reinstall the LaunchAgent:
```
cp scripts/com.leaderboard.swim-poll.plist ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.leaderboard.swim-poll.plist 2>/dev/null
launchctl load -w ~/Library/LaunchAgents/com.leaderboard.swim-poll.plist
launchctl list | grep swim-poll        # confirm it's registered
```
Runs once daily at 07:00 (and catches up on wake if the mini was asleep). Logs to
`~/Library/Logs/leaderboard-swim-poll.log`. Re-importing an already-saved meet is a
no-op (ingest is idempotent, keyed on edition+person+event), so no message-id
tracking is needed.

**If the worktree moves** (e.g. after `feat/scraping` merges to main), update the
script path in `~/Library/LaunchAgents/com.leaderboard.swim-poll.plist` to the main
checkout and reload — the wrapper itself is self-locating.

## Near-misses
Each meet lists swimmers who share a family surname, or are a 1–2 char typo away
from a roster name, but didn't exactly match — surfacing a nickname/misspelling as
a line to check rather than a silently dropped kid. Fix it by adding/renaming the
person in the DB and re-running. (Unrelated swimmers who merely share a *first*
name — e.g. a different-team "Aurora" — are correctly ignored.)

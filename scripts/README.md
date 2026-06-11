# Swim results backfill — operational scripts (Phase 2 reference)

`swim-backfill.cjs` downloads every Glade meet-results PDF from Gmail and imports
the family's swims. Proven on the full 2024–2026 archive (9 meets, 47 results).
This is the working reference to productionize **Phase 2** (the daily auto-importer).

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
- Preview (no DB writes):  `node scripts/swim-backfill.cjs dry`
- Import:  `PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/swim-backfill.cjs live`

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

## To make it Phase 2 (daily auto-importer)
Wrap in a daily schedule (Netlify scheduled function or Mac-mini cron). After a
successful import, mark the email processed (add a Gmail label, or store its
message-id) so the same meet never imports twice. Note: paths here are absolute
for this Mac mini; parameterize when moving to Netlify.

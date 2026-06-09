# trime — Family Race Results Tracker

A site to store the family's race results (triathlons, swim meets, gravel rides, trail/road
runs) and compare progress year over year for races we repeat annually.

## What it does
- **Person pages** — each family member's full race history across all sports, with PRs.
- **Recurring-race pages** — click a race we do every year and see year-over-year (YoY) finish
  times and split-by-split comparisons.
- **Paste-a-URL ingestion** — paste a results URL, Claude extracts the data, you review/fix it,
  then save. Stores our family's results plus podium + nearby finishers for context (e.g.
  "on the podium with the same people every year") and a link back to the full original results.
- **Access** — public to view, login required to add/edit.

## Stack
- **Astro 6** (SSR via `output: 'server'`, `@astrojs/netlify` adapter)
- **Supabase** — Postgres database + Auth + Row-Level Security (public read, authenticated write)
- **Anthropic Claude API** — structured extraction of messy results pages (Haiku 4.5 default,
  Sonnet 4.6 for tricky pages)
- **Netlify** — hosting (push to `main` auto-deploys)

## Environment variables
See `.env.example`. Copy it to `.env` for local dev; set the same vars in the Netlify dashboard
for production.
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` — browser-safe (read via RLS).
- `SUPABASE_SERVICE_ROLE_KEY` — server only (scrape/save endpoints); never exposed to the browser.
- `ANTHROPIC_API_KEY` — server only (extraction).

## Data model (see `supabase/migrations/`)
- `person` — family members and scraped competitors are both "people" (`is_family` flag).
- `race` — the recurring event identity you click into for YoY.
- `race_edition` — one running of a race in one year (date, source_url, format, weather).
- `result` — one person's result in one edition (time, places, division, status, `context`).
- `split` — normalized leg/lap/checkpoint splits per result.

## Key directories
- `src/lib/` — `supabase.ts` (clients), `extract.ts` (Claude extraction), `compare.ts` (YoY logic),
  `platforms/` (per-timing-platform JSON-API adapters), `format.ts` (time/pace helpers).
- `src/pages/` — public pages; `src/pages/api/` — `scrape`/`save` server endpoints;
  `src/pages/admin/` — auth-gated entry + review screens.
- `supabase/` — `migrations/` (reversible SQL) and `seed.sql` (family members).

## Commands
- `npm run dev` — dev server (binds to `--host`; preview from laptop at `http://100.71.23.28:<port>/`)
- `npm run build` — production build
- `npm run preview` — preview the production build locally

## Conventions
- Times stored as integer **seconds** in the DB; formatted to `h:mm:ss` in the UI (`src/lib/format.ts`).
- Migrations are reversible (every `up` has a `down`).
- Never commit `.env` or secrets. Don't push to `main` without explicit approval (auto-deploys).

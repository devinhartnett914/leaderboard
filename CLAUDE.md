# Leaderboard — Family Race Results Tracker

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

## Design system
Principled & patterned: the UI is built from a small set of shared components + tokens so new
pieces fall out of the system. **Reuse or extend these before writing a one-off** — when a
pattern repeats ~2–3×, extract it rather than copy it.

### Tokens (defined `:root` in `src/layouts/Layout.astro`)
- Colors: `--bg/--surface/--surface-2`, `--text/--muted/--faint`, `--accent` (cyan), discipline
  accents `--swim/--bike/--run`, `--gold` (PR), `--faster/--slower` (deltas), `--border/--line-strong`.
- Category color/icon/label live in `src/lib/categories.ts` (`catColor`/`catIcon`/`categoryOf`) —
  the single source for sport tinting; every card reads from it (don't hardcode sport colors).
- Fonts: `--font-display` (Bebas Neue — headings + times, **all-caps face**), `--font-mono`
  (JetBrains Mono — labels/captions), `--font-body` (Inter Tight). Plus `--radius`, `--shadow`.

### Shared components (`src/components/`)
- `RaceTitle.astro` — category icon + race name, vertically centered. The one race title; use
  everywhere a race is named.
- `PersonChip.astro` — avatar + name (mono uppercase). The one way to name a family member; pass
  `link={false}` when it sits inside another link.
- `ResultMarks.astro` — medal + PR markers left of a time (medal outer, PR nearest the time; only
  present markers render — no reserved empty slots).
- `PrBadge.astro` / `PodiumMedal.astro` — the two marks, kept identical via `.mk-glyph` (1.1rem) +
  `.mk-cap` (0.5rem). **Glyph-over-caption** is the recurring "mark" pattern (also the date rail and
  the race-page PR best-time/year).
- `ResultRow.astro` / `MeetCard.astro` / `RaceGroupCard.astro` — the three feed cards (tri·run /
  swim meet / multi-family-member race), all living in the shared `.results` subgrid so finish
  times line up across every card.
- `Avatar.astro` — circular photo with an initials fallback.

### Layout patterns (keep consistent across cards)
- Card top row = the **type · distance** tag, on its own line *above* the race name. On the
  combined feed a `PersonChip` leads that row, pipe-separated from the tag.
- Finish time is right-aligned with marks to its left; place / division sit at the far right.
- Run every division string through `abbrevDivision()` before display (`8 & Under` → `8&U`).

### Gotcha
Astro's dev HMR can serve **stale scoped CSS** after a component edit — verify the *served* output
(`curl` the page), and `touch` the component (or restart `npm run dev`) to force a recompile.

## Commands
- `npm run dev` — dev server (binds to `--host`; preview from laptop at `http://100.71.23.28:<port>/`)
- `npm run build` — production build
- `npm run preview` — preview the production build locally

## Conventions
- Times stored as integer **seconds** in the DB; formatted to `h:mm:ss` in the UI (`src/lib/format.ts`).
- Migrations are reversible (every `up` has a `down`).
- Never commit `.env` or secrets. Don't push to `main` without explicit approval (auto-deploys).

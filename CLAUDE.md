# Leaderboard — Family Race Results Tracker

A site to store the family's race results (triathlons, swim meets, gravel rides, trail/road
runs) and compare progress year over year for races we repeat annually.

## Project tracking
Issues live in **Linear → project "Leaderboard"** (team "Devin Hartnett", key `DEV`). Follow the
Linear Workflow in the global `~/.claude/CLAUDE.md`: only autonomously work `Todo` issues, finish
into `Ready for Review` (never `Done`) with notes + a review link, commit per-issue referencing
`DEV-#`. The `/dispatch` skill works this project's whole Todo queue.

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
- **Type / spacing / tracking scales** (role-named): `--fs-cap/--fs-label/--fs-chip/--fs-event/`
  `--fs-value/--fs-time-sm/--fs-time/--fs-time-lg`, `--ls-tight/--ls-wide/--ls-wider`, `--sp-1…6`.
  Use a token, **don't hardcode a font-size / spacing** — that's what makes "edit once, hits all"
  work. Add a new step only when a genuinely new size recurs.
- Category color/icon/label live in `src/lib/categories.ts` (`catColor`/`catIcon`/`categoryOf`) —
  the single source for sport tinting; every card reads from it (don't hardcode sport colors).
- Podium medals (glyph/name/color) live in `src/lib/medals.ts` (`medalEmoji`/`MEDAL_*`) — the one
  source for `PodiumMedal` and the podium filter chips.
- Fonts: `--font-display` (Bebas Neue — headings + times, **all-caps face**), `--font-mono`
  (JetBrains Mono — labels/captions), `--font-body` (Inter Tight). Plus `--radius`, `--shadow`.
- Global utilities (`is:global`): `.sr-only` (visually-hidden, screen-reader-only labels),
  `.micro-label` (the mono-uppercase field-label), `.caption` (the tighter mark caption). Reach
  for these in new components instead of re-declaring the mono-uppercase-tiny block.

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
  times line up across every card. The **swim-meet detail page** (`/races/[slug]`) reuses the same
  row anatomy (`EventChip` + `ResultMarks` + `ResultPlaces`) — don't hand-roll a meet grid.
- `ResultPlaces.astro` — THE standings block: division-first, label-free (`5th · F40-44`), overall
  demoted to a muted subline, non-award → `Non-Award`. Built on `divisionRank()`. Used by every
  race row. `EventChip.astro` — the one way to name a swim event (icon + label, linked).
- `Avatar.astro` — circular photo with an initials fallback. The one avatar everywhere (incl. the
  home family cards).
- Division display has ONE core: `divisionParts()` in `src/lib/format.ts` (group + rank + the
  non-award rule); `divisionRank()` formats it inline, `Division.astro` stacks it. Don't render
  `division`/`*_place` by hand.

### Layout patterns (keep consistent across cards)
- **Card standard: type & racers ABOVE the race name.** The `CardSubMeta` band (one line, above
  the title on every card) carries the **type · distance** tag *and* who's racing, pipe-separated.
  Racers render via `RacerBadge`: one → a `PersonChip` (avatar + name), 2+ → stacked avatars + an
  "N Racers" count. This badge is used on **every** race with multiple family members (the grouped
  feed card, recent tiles, upcoming) — not just Upcoming. (Type-above-name scales better on narrow
  / mobile widths than stacking it below.)
- Finish time is right-aligned with marks to its left; the division-first standing sits at the
  far right (via `ResultPlaces`). Header captions (Overall/Division/Finish) are dropped visually
  but kept as `.sr-only` for screen readers.
- Run every division string through the division helpers (`divisionRank`/`divisionParts`, which
  call `abbrevDivision`/`swimDivision`) — never format an age-group/heat by hand.

### Adding a new sport / match type (tennis, ski, …)
The system is designed to absorb new types without touching every card:
1. Add its `sport` to `src/lib/types.ts` (`SPORT_LABELS`) and a color + icon in
   `src/lib/categories.ts` (`CAT_COLOR`/`CAT_ICON`). That alone tints it everywhere.
2. If it's result-shaped like the others (a time + place/division), it flows through the existing
   feed cards and `ResultPlaces` for free. If it has a fundamentally different shape (sets/games,
   runs/heats), add a new feed-card component beside the three — but reuse `DateRail`, `CardTopRow`,
   `RaceTitle`, `ResultMarks`, and the tokens; don't re-invent the shell.

### Cross-app roadmap (planned: a second app shares these components)
A second app (swim-team meet results + leaderboards) will reuse this design system. The lightweight
foundation is in place (explicit tokens, pure components, single-source helpers). When the second
app starts, extract the shared layer (`layouts` tokens + `categories`/`medals`/`format` + core
components) into a **workspace package** (pnpm/npm workspaces monorepo, or a `packages/ui` shared
package) consumed by both apps — prefer a workspace over a published npm package initially. Defer
Tailwind / a design-token toolchain until multiple external consumers actually exist. **This
extraction is its own owner-approved project — don't start it as part of routine work.**

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

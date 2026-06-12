# Swim event page — layout options

Status: **proposal only** (no code touched). For Devin to review/pick.

## The problem

`/swim/[event]` (e.g. `/swim/50m-freestyle`) is the page for "every recorded
swim of this event across every meet, fastest-tracked over time." Today it
groups by swimmer and shows their occurrences as date-keyed cards:

```
+-- Sierra Hartnett ⭐ 57.40  1 swim ---------------+
| Jun 6 2026 · Reston Swim League: AW @ GL · 9-10 C |
|   🥈 ⭐ 57.40                                     |
|   PR                                              |
+---------------------------------------------------+
```

The structure works for one swimmer with one occurrence. It feels like an
antipattern as soon as you ask the questions the page is *for*:

- **"Who's the fastest in the family at this event right now?"** You can't
  answer this without scanning per-swimmer best times one block at a time.
  The grouping is by swimmer, so cross-swimmer comparison is awkward.
- **"How has Sierra's 50 Free progressed?"** This works — but it's a list
  of occurrence cards, not a progression chart. Eye has to read times in
  reverse-chrono and subtract.
- **"How did everyone do at this past Saturday's meet?"** This isn't really
  what the page is for, but the same data is on `/races/[meet-slug]` and the
  user might land here looking for it.
- **"What's the family's best 50 Free ever?"** The "Best" pill (now PR) is
  on each swimmer's section, never collapsed family-wide.

The page tries to be three things — leaderboard, progression view, history
list — and is doing the history-list job by default.

## What the page is for, in order

1. **Family-wide leaderboard of bests** at this event. ("Who has the family
   record? What's it stand at?")
2. **Per-swimmer progression** at this event. ("How is Mae's 50 Free trending?")
3. **History list** for context. ("When was that PR? Which meet?")

## Three layout options

---

### Option 1 — Leaderboard top, progression below, history collapsed

Fastest answer first; everything else is below the fold.

```
+----- 50m FREESTYLE ----------------------------------+
| Family records  · 25m course · 4 swimmers · 18 swims |
+------------------------------------------------------+

  FAMILY BESTS                                       
  🥇 Sierra Hartnett   ⭐ 57.40   2026 · 9-10 division
  🥈 Mae Hartnett      ⭐ 1:02.10 2026 · 7-8 division 
  🥉 Devin Hartnett    ⭐ 28.50   2024 · Masters      
     Owen Hartnett     ⭐ 1:14.20 2026 · 5-6 division 

  PROGRESSION  ────────────────────────  show all swimmers ▾

    Sierra   |▔▔▔╲___________________
             58.20             57.40
    Mae      |▔╲___________________
             1:04.10           1:02.10
    Devin    |__▔▔▔____________________
                28.20  28.50  28.30
    Owen     | (1 swim)

  RECENT SWIMS  ──────────────────  toggle all years ▾

    Jun 6, 2026  Reston · AW @ GL   Sierra ⭐ 57.40   🥈
    May 30, 2026 Reston · GL @ TR   Sierra 58.10
    May 30, 2026 Reston · GL @ TR   Mae    1:02.10 🥇 ⭐
    ...                                              
```

**Pros**

- Answers question 1 in the first 200px. The PR star and time placement
  reuse `PrTime` so nothing new visually.
- Progression strip is compact (one row per swimmer, a sparkline-y trend
  with first and current time) — readable in a glance.
- History is there but doesn't dominate.

**Cons**

- Sparklines aren't trivial — either inline SVG (small build) or a CSS
  shape approximation. Worth doing once and reusing on `/people/[slug]`.
- For events where only one swimmer has data (most of the youth events),
  the leaderboard collapses to one row and reads weirdly. Need a graceful
  single-swimmer mode.

---

### Option 2 — Per-swimmer track is the spine; leaderboard is a small header

Keep the per-swimmer grouping (today's structure) but lead with a tight
header-level leaderboard so you see the family ordering instantly.

```
+----- 50m FREESTYLE ----------------------------------+
| 🥇 Sierra ⭐ 57.40   🥈 Mae ⭐ 1:02.10   🥉 Devin ⭐ 28.50  Owen 1:14.20 |
+----------------------------------------------------------------------+

  SIERRA HARTNETT ⭐ 57.40 (2026)              ─── 3 swims ─────
  Jun 6, 2026   AW @ GL   ⭐ 57.40  🥈   −0.80 vs May 30
  May 30, 2026  GL @ TR      58.20         (first swim)
  May 23, 2026  HU @ AW      58.50  +0.30 vs May 30

  MAE HARTNETT ⭐ 1:02.10 (2026)               ─── 2 swims ─────
  Jun 6, 2026   AW @ GL   ⭐ 1:02.10 🥇  −2.00 vs May 30
  May 30, 2026  GL @ TR      1:04.10
```

**Pros**

- Closest to today's UI — least disruption. Re-uses the existing
  `.occ` grid with very small changes.
- Header row gives the family ordering in one line; per-swimmer tracks
  give the progression and history at once.
- No new components (sparkline, etc.) needed.

**Cons**

- Header row gets crowded with 4+ swimmers. Truncation rules needed.
- Doesn't separate "progression" from "history" — they're still mashed
  together inside each swimmer block. Question 2 ("how is Mae trending")
  is still a list-read.

---

### Option 3 — Tabbed: Leaderboard / Progression / History

Three views, one URL, one tab strip. Each answers one question cleanly.

```
+----- 50m FREESTYLE -----------+
| Reston Swim League · 25m yards |
+--------------------------------+
| [LEADERBOARD] [TREND] [HISTORY] |
+---------------------------------+

(Leaderboard tab — like Option 1 top)

(Trend tab — full-width chart, one line per swimmer,
 X axis = meet date, Y = time, lower is better, with PR
 markers highlighted on each line)

(History tab — the current per-swimmer cards list)
```

**Pros**

- Each tab does one job well.
- The chart tab is genuinely fun for parents watching progression and
  is the answer-to-question-2 done right.
- History tab is exactly today's UI — zero work to preserve.

**Cons**

- Tab UI is a new pattern that doesn't exist elsewhere in the site
  (everything else is single-page, scroll-down). Adds a navigation
  primitive just for this one page.
- Charts are a real library decision — Chart.js, uPlot, hand-rolled SVG?
  Bundle size and SSR-friendliness vary.
- A tab strip hides two-thirds of the data behind a click. The current
  page shows everything at once.

---

## Recommendation

**Option 1**, with a flat sparkline shape for the progression section
(no chart library) and a graceful single-swimmer collapse.

Why:
- It answers the three real questions in the order they actually matter.
- The leaderboard + history strip reuse pieces already in the design
  system (`PrTime` for the family-best row, `PodiumMedal` for the
  per-swimmer place markers, the date-rail anchor from the feed cards
  for the history list).
- It is the option most consistent with how `/races/[slug]` already
  works: bold "PR" rail at the top, year cards in a strip below. Same
  shape, applied to swim.
- A "sparkline" can be a pure CSS / inline SVG element with no library
  — first time × last time with a 30px wide path connecting them. Looks
  like a trend without being a chart.

Option 2 is the cheapest path if Devin wants to move on tonight and
revisit later. Option 3 is the most ambitious; would not pick it until
Tri•Me has a charting story for `/people/[slug]` too — building it just
for this one page is unbalanced.

---

## Open questions

- **Does the page need to know the course (25y vs 25m vs 50m)?** Bests
  for different courses are not comparable. Today the URL is
  `/swim/50m-freestyle` (event slug) and the data filters by event only.
  If we ever import non-25m-course swims, the leaderboard becomes
  apples-and-oranges. Worth splitting bests by course (e.g. tab the
  leaderboard by course, or scope the page to a single course).
- **"Family best ever" vs "Family best this season":** the current PR
  is the all-time best. For a youth swimmer who outgrew an age group,
  the "season best" might be more interesting. Add a small toggle?
- **Are we okay surfacing siblings competing at the same event?** The
  leaderboard explicitly ranks family members against each other; the
  rest of the site avoids this. Worth checking with the swimmers (and
  the parents) before shipping a "Sierra > Mae" row at the top.

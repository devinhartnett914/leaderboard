# IA proposals — Leaderboard

Status: **proposal only** (no code touched). For Devin to review/pick before any
implementation. Pulls on five things observed in the current site:

1. The two spines of the data are **people** and **races**, but only "Races" is
   in the nav. There is no People/Family link anywhere except the homepage tiles.
2. `/races` is a *results feed* (newest results first), while `/races/[slug]` is
   a *recurring-race identity* (the year-over-year page). Same name, very
   different shape — and the path implies one is a child of the other.
3. There are no breadcrumbs and no active-nav state. Nothing tells you where
   you are once you click past the home page.
4. The homepage is half landing-page (hero + Family tiles + Upcoming) and half
   dashboard (Recent races feed). Both jobs are reasonable; mashed together
   they each feel half-done.
5. Swim has its own model (per-event series at `/swim/[event]`) and the only
   way to discover it is to click into a swim row on `/races` and then into an
   event name. There is no "browse swim events" page.

The proposals below give three concrete options + a recommendation.

---

## What's there today

```
/                  Hero • Family tiles • Upcoming • Recent races (feed-like)
/races             All-results feed (newest first), grouped where it makes sense
/races/[slug]      Recurring-race page: YoY year cards, rivals, family tracks
/people/[slug]     One family member's full history with filter chips
/swim/[event]      One swim event series across every meet, per swimmer
/admin             Add-results placeholder
```

Top nav: **Home · Races · Add results**.

---

## Option A — Add the missing spine, keep the rest

Smallest move. Add "Family" to the nav, give every page an active-nav state,
and add a one-line breadcrumb-style "back-up" link to detail pages.

```
[ 🏁 Leaderboard ] Home   Family   Races   Add results
                                   ─────
                                   (active)
```

```
/people            NEW: Family index page (a fuller version of the homepage
                   tiles, with per-person result counts + last-race date)
/people/[slug]     ← Family / Person     (back-up link in the page head)
/races             unchanged (combined feed)
/races/[slug]      ← Races / Backyard Burn (back-up link)
/swim              NEW: index of every swim event series (auto-built from
                   /swim/[event] data) — "25 Free · 50 Free · 100 Free…"
/swim/[event]      ← Swim events / 50 Free
```

```
+----------------------------------------------+
| ← Races                                      |
|                                              |
|   🚴  BACKYARD BURN — FOUNTAINHEAD           |
|   Trail Run · 10 Mile · Fairfax, VA          |
+----------------------------------------------+
```

Pros: tiny diff. No information renamed, no URL breaking. Adds the missing
discoverability for People + Swim. Active-state nav is essentially free.
Breadcrumb is a single component that sits inside the existing page-head.

Cons: doesn't address the "`/races` feed vs `/races/[slug]` identity" name
overload — they still share a path and a word.

---

## Option B — Rename to match what each thing actually is

Tackle the naming overload head-on. `/races` is a *feed of results*; rename
it to that. `/races/[slug]` is the *race identity*; keep that route, but make
it clear that it's a thing of its own.

```
[ 🏁 Leaderboard ] Home   Family   Results   Races   Add
```

```
/                  unchanged
/people            NEW: family index
/people/[slug]     unchanged
/results           ← was /races. The combined feed (every result, newest first)
/races             NEW: index of every recurring race we've done (the series),
                   grouped by sport, each linking to the YoY page
/races/[slug]      unchanged — same content, but now reached from /races
/swim              NEW: index of swim events
/swim/[event]      unchanged
/admin             unchanged
```

```
+----------- /races (recurring race index) -----------+
|  TRIATHLON                                          |
|  🚴 Reston Sprint — 4 yrs                           |
|  🚴 Lake Anna Olympic — 2 yrs                       |
|                                                     |
|  TRAIL                                              |
|  ⛰  Backyard Burn — Fountainhead — 3 yrs            |
|  ⛰  Backyard Burn — Hemlock — 2 yrs                 |
|                                                     |
|  SWIM MEETS                                         |
|  🏊 Reston Swim League — 12 weeks                   |
+-----------------------------------------------------+
```

Pros: names match meaning. "Results" is what the feed is. "Races" is what
the YoY page is. Browsing the recurring races is finally a thing you can do
without typing a slug.

Cons: rename = breakage. Anyone with a bookmarked `/races` lands on the new
"recurring races" index, not the feed. Easy to mitigate with a redirect, but
it is a real rename. Adds two new index pages (people, races, swim — three).

---

## Option C — Homepage becomes the dashboard; subpages are the lists

Lean into the dashboard half of the homepage and let it carry more weight,
so the nav stays minimal. The home becomes the place you live; the rest is
"all of X".

```
[ 🏁 Leaderboard ] Home   Results   Family   Races   Add
                   ────
                   (this is the dashboard, not a landing page)
```

```
/                  DASHBOARD: latest PR · latest race · upcoming-next · medals-this-year
                   (cards, not just a feed slice; still links into the detail pages)
/results           the feed (rename of /races)
/family            family index (was hidden on the home)
/races             recurring-race index (sport-grouped)
/races/[slug]      YoY page
/swim              swim event index
/swim/[event]      event series page
```

Pros: makes the home land harder. The "Recent races" module turns into a
real dashboard with five or six purpose-built cards instead of a feed slice,
and every subpage becomes a focused list. Active-nav state still falls in.

Cons: biggest design lift — the dashboard cards need actual design work
(Devin's intent on what to surface), so this can't ship behind one PR; it's
a multi-step move. Renames `/races` too. The hero copy on the home needs
to retire or move.

---

## Wayfinding additions (apply to A/B/C alike)

These are cheap and shared across all three options. Worth doing whichever
option lands.

- **Active-nav state.** Highlight the section the current path belongs to.
  No new nav items; one CSS class on the link whose URL prefix matches the
  current page.
- **Back-up link** in the page-head of every detail page (people, races,
  swim/event). Format: `← Section`. Sits above the H1, font-mono, accent
  color, current size — matches the "All results ←" link already on the
  swim event page.
- **Drop the hero on subpages.** The "Every race. Every year. One place."
  block lives on `/` only; subpages get the existing page-head treatment.
- **Mobile nav.** Three items fit on mobile; four is fine; five (Option C)
  starts to need a hamburger. Worth checking before picking C.

---

## Recommendation

**Option A** — at least to start.

It's the smallest move that resolves the two most visible gaps (no People
link, no active-nav, no way-back) without renaming any path. The "feed vs
identity" naming overload is real, but `/races` and `/races/[slug]` reading
as "the races section, and a specific race" is a defensible interpretation —
not a forced one. The recurring-race index page from Option B is the part
of B worth pulling forward; if Option A ships first and we discover people
actually do want to browse recurring races, we can layer Option B's rename
on later (with a redirect) once the demand is real.

Option C is the most ambitious and the most fun, but it's also the option
that most needs Devin's intent on what the dashboard cards actually surface.
It belongs in a follow-up once A is in.

Suggested sequence:

1. Add "Family" to the nav. Add active-nav state. (small PR)
2. Add a `<Breadcrumb />` component, use it on `/people/[slug]`,
   `/races/[slug]`, `/swim/[event]`. (small PR)
3. Build `/people` (family index) and `/swim` (event index). (one PR each)
4. Evaluate after a week of use — does the homepage need to keep its feed
   slice now that `/races` is one click away from every page? Does anyone
   miss the rename to `/results`?

---

## Open questions (would change the recommendation)

- **Is "Family" the right word, or "People"?** Family reads warmer; People
  generalizes if non-family ever gets added (rivals, training partners). The
  rest of the code already calls it `person`, so `/people` is the lower-friction
  path — but I'd write the nav link as "Family" either way.
- **How important is the "browse recurring races" page?** If "every year we
  do the same 12 races" is the *point* of Leaderboard, that index should be in
  the nav (Option B). If the recurring page is more of a *destination you
  arrive at after seeing a result*, Option A is fine.
- **Does the homepage stay landing-y or go dashboardy?** If you'd rather
  someone arriving at `/` immediately see "Devin's latest PR" + "Sierra's
  next meet" instead of a hero, that's Option C.

---

## Smaller, separate gripes worth noting

These are below the level of an IA decision but came up while auditing,
and any of them could be picked off in a small follow-up PR:

- **Homepage Upcoming card has no category icon.** It renders the race
  name as a plain `<div class="name">` plus a sport `.pill` on the right.
  Adding `<RaceTitle />` would put the same icon-before-name treatment
  every other card uses, with the sport pill staying on the right for
  the calendar feel. Couldn't verify visually (no upcoming items in the
  current data) so left for Devin's call.
- **No "back-up" link on `/people/[slug]` or `/races/[slug]`.** The
  swim event page already has `← All results` in its header strip.
  Once `/people` and `/races` (the index pages) land, every detail page
  should grow the same line — same component, same style. Cheap once
  the index pages exist.
- **Format-badge is the only gold-gradient pill in the system.** It's
  the big "SPRINT" / "OLYMPIC" / "10K" tag in the race header on
  `/races/[slug]`. It looks great but it's the only piece of UI using
  that gradient — if the IA reshuffle moves the format somewhere new
  (e.g. into a recurring-race index card), the gradient should follow
  or be retired, not copied into a fourth place.

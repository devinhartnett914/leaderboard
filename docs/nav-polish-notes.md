# Navigation polish — what shipped, what didn't

## What shipped (this branch)

Two restrained, no-JS additions in `src/layouts/Layout.astro`:

1. `@view-transition { navigation: auto; }` — a CSS-only rule for the
   cross-document View Transitions API. Browsers that support it
   (Chromium 126+ at the time of writing) will run a soft default
   cross-fade between same-origin pages. Firefox and Safari just ignore
   the rule.
2. A 180ms `page-enter` keyframe animation on `<main>` — opacity 0→1 and
   a 4px slide-up — so the page softly settles when you arrive. This
   runs everywhere as the fallback for browsers without the CSS
   View Transitions API, and reads as a tasteful "you arrived"
   confirmation.
3. Honors `prefers-reduced-motion: reduce` — the animation is suppressed.

There is no JS. There is no SPA. SSR still serves the full page per
request. Both rules are additive and safe to revert (delete the two
blocks).

## What didn't ship — `<ClientRouter />` (Astro's SPA + transitions)

Astro 6 ships a `<ClientRouter />` component that intercepts internal
link clicks, fetches the next page with `fetch()`, swaps the `<body>`
in place, and runs the View Transitions API around the swap. It also
makes the navigation feel instant by skipping the browser's
white-flash-then-paint cycle.

This is the "richer" option and would have layered nicely on top of
the CSS-only rule above. I didn't ship it because:

- **The `/people/[slug]` filter chips would break.** The page wires up
  filter buttons in a `<script>` block:
  ```ts
  const cards = [...document.querySelectorAll<HTMLElement>('.rcard, .mcard')];
  const chips = [...document.querySelectorAll<HTMLElement>('[data-f]')];
  chips.forEach((ch) => ch.addEventListener('click', () => {...}));
  ```
  With ClientRouter, the script's module runs once and is cached;
  after a nav, the body is swapped and the listeners point to old
  (now-detached) DOM nodes. Fix is to listen for `astro:page-load`
  and re-bind every nav — or to make the script `is:inline` and let
  Astro re-execute it. Either path is a small refactor I don't want
  to do without Devin's eyes on it.
- **Verification gap.** ClientRouter changes how scripts run, how
  scroll position restores, and how SSR data hydrates. None of that
  can be confirmed by curl alone — you have to actually click around
  in a browser and check that filtering still works, scroll position
  is sensible, and there's no flicker on the swim event page (which
  is one of the more layout-heavy pages). I can write the code but I
  can't watch it run.
- **Marginal benefit over the CSS rule.** Most of the perceived
  smoothness comes from the View Transitions API itself, which the
  shipped `@view-transition` rule already activates for supporting
  browsers — without any of the SPA gotchas.

## When to revisit `<ClientRouter />`

It's worth turning on once *one* of these is true:

- The filter-chip script (and any future client-script) is moved
  inside an `astro:page-load` listener (or marked `is:inline` and
  audited).
- A scroll-position regression is observed across nav (right now
  there's none, because every nav is a full document load).
- A page-to-page state transition lands that genuinely benefits from
  SPA-style animation (e.g., a result card morphing into the same
  card on its detail page via shared `transition:name`).

When you do flip it on, the steps are:

```astro
---
import { ClientRouter } from 'astro:transitions';
---
<head>
  <ClientRouter />
  ...
</head>
```

And then mark any shared element you want to morph with
`transition:name="…"` on both pages. Start with the race title or
person chip — both are good candidates.

## Why no per-link "go deeper" cue

The task asked for tasteful loading/transition feedback, especially
when going *deeper* into the IA. I considered a CSS class on the
clicked link that triggers a fade-out of the source page before the
new one arrives — but:

- It requires JS to attach to `click` on every internal `<a>`.
- It double-animates against the View Transitions fade in
  supporting browsers.
- It runs the risk of leaving the source page faded out if the next
  page errors or is slow.

The CSS-only page-enter animation gives you the *arrival* half of
that feeling without any of those failure modes. If a "departing"
cue feels important later, it should be part of the ClientRouter
move — `transition:animate="slide"` on the body, for example —
not a one-off JS handler.

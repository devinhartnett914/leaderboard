# Mobile-responsive detail pages (reference)

Blueprint for making the **person page** (`/people/[slug]`) and **race page** (`/races/[slug]`)
readable on phones. The wide results table and the year-over-year (YoY) matrix both overflow on
narrow screens and cut off race names.

> **Provenance & caveat.** Extracted from the orphaned branch
> `claude/dev-server-qa-phone-pkj21o` (commit `7312221`, "Make results tables responsive on
> mobile") before that branch was deleted. The UX sweep has since rewritten both pages, so this is
> a *pattern reference*, not a patch — the selectors/markup below need re-fitting to the current
> components (e.g. `ResultPlaces`) when we do the detail-page conversion. Pick this up alongside
> that work.

## Person page — stack the table into cards on phones

The 6-column table (race · year · time · splits · overall · division) doesn't fit. On `≤640px`,
collapse each row into a card: full race name as the header, the rest as labeled rows.

Markup change: drop a `data-label` on each `<td>` (used as the row label via `::before`), and tag
the race-name cell `class="cell-race"` so it renders as the card header.

```css
.stats { display: flex; flex-wrap: wrap; gap: 1rem; }  /* stats row wraps too */

@media (max-width: 640px) {
  .table-card { overflow-x: visible; }
  .sport-block thead { display: none; }
  .sport-block table,
  .sport-block tbody,
  .sport-block tr,
  .sport-block td { display: block; width: 100%; }
  .sport-block tbody tr { padding: 0.95rem 1.1rem; border-bottom: 1px solid var(--border); }
  .sport-block tbody tr:last-child { border-bottom: none; }
  .sport-block td {
    border: none; padding: 0.25rem 0;
    display: flex; justify-content: space-between; align-items: baseline; gap: 1rem;
    text-align: right; white-space: normal;
  }
  .sport-block td::before {              /* label from data-label="…" */
    content: attr(data-label);
    flex-shrink: 0; text-align: left;
    font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; color: var(--muted);
  }
  .sport-block td.cell-race {            /* race name = card header, never truncated */
    display: block; text-align: left;
    font-size: 1.05rem; font-weight: 600;
    margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);
  }
  .sport-block td.cell-race::before { content: none; }
  .sport-block td.splits { display: block; text-align: left; }       /* long splits stack */
  .sport-block td.splits::before { display: block; margin-bottom: 0.15rem; }
}
```

## Race page — keep the YoY matrix scrollable, but pin the leg-label column

The matrix is inherently 2D, so let it scroll sideways — but pin the leftmost leg-label column so
the row stays identifiable, and pack the edition chips two-up.

```css
@media (max-width: 640px) {
  .track table th[scope='row'],
  .track thead th:first-child {
    position: sticky; left: 0; z-index: 1;
    background: var(--surface); border-right: 1px solid var(--border);
  }
  .editions { gap: 0.5rem; }
  .edition-card { min-width: 0; flex: 1 1 calc(50% - 0.5rem); }
}
```

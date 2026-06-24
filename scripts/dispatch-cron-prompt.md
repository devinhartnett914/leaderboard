# Daily dispatch + release run (Leaderboard)

You are running **unattended** on the Mac mini for the **Leaderboard** repo (Astro race-results
site). Read this repo's `CLAUDE.md` first. Work fully autonomously — never ask for confirmation.
Linear: team "Devin Hartnett" (key `DEV`), project **Leaderboard**.

Do the two passes below **in order**: first **RELEASE** (ship approved work), then **DISPATCH**
(build the queue). If `DISPATCH_DRY` is set in the environment, do the RELEASE pass in
detect-only mode (no merging, no pushing) and SKIP the dispatch pass — just report what you would
have shipped.

---

## Pass 1 — RELEASE: batch-merge Done issues to `main` (one deploy)

**Goal:** ship every cleanly-mergeable **Done** issue as a SINGLE batched push to `main`, so N
Done issues cause at most ONE Netlify deploy. Marking an issue **Done** is Devin's authorization
to ship it (Done is a Devin-only state). Pushing `main` currently does NOT deploy (Netlify isn't
wired yet); once it is, this push becomes the deploy — so keep it to one per run.

1. `git fetch origin --prune`. Check out `main` and bring it level with origin:
   `git checkout main` then `git merge --ff-only origin/main`.
2. Get the Done set: every issue in state **Done** in the Leaderboard project (Linear MCP).
3. For each Done issue, its **canonical branch is the issue's Linear `gitBranchName`** (from
   `get_issue`). Only consider `origin/<gitBranchName>`. **Ignore every other branch** — the
   legacy `dispatch/*` batch branches are handled manually by Devin, never by this job.
4. Build the merge list. A Done branch qualifies ONLY if ALL of these hold:
   - `origin/<gitBranchName>` exists.
   - It merges into `main` with **no conflict** (test with `git merge --no-commit --no-ff`, then
     `git merge --abort` to undo the trial — never leave a half-merge).
   - Every commit it would add (`git log main..origin/<gitBranchName> --oneline`) references only
     **Done** DEV-ids. If any added commit references a DEV-id that is NOT Done, the branch is
     mixed → **skip it** and note why.
   If a branch doesn't qualify, skip it and remember the reason; do not force anything.
5. If the merge list is empty → do nothing (no merge, no push, no deploy). Go to Pass 2.
6. Otherwise merge every qualifying branch into local `main` (ff or a merge commit each).
7. **Build gate:** run `npm run build`. If it fails, **abort the release** — reset `main` back to
   `origin/main` with `git merge --abort` (if mid-merge) or `git checkout main` (do NOT use
   `reset --hard`); push nothing; record the build failure. Go to Pass 2.
8. If the build passes: `git push origin main` **exactly once** (plain push — NEVER `--force`).
   That single push is the batched deploy.
9. For each issue shipped, add a short Linear comment: merged to `main` in `<short-sha>` on
   `<date>` (note "deployed" only once Netlify is wired). Leave its state as **Done** — never
   change a Done issue's state.

**RELEASE guardrails (hard):** only `main` + the Done branches; one non-force push max; build must
pass first; skip-don't-force on any conflict or mixed branch; never `reset --hard`, never
`--force`, never `branch -D`.

---

## Pass 2 — DISPATCH: work the Todo queue (skip if `DISPATCH_DRY`)

Run the **`/dispatch` skill** for this repo. It pulls every **Todo** issue in the Leaderboard
project and takes each to **Ready for Review** on its **own per-issue branch off the freshly
updated `main`** (branch name = the issue's Linear `gitBranchName`), pushing that branch so the
work persists and Devin can review it. The skill never merges to `main` and never marks an issue
Done/In Review — those stay Devin's. Follow the skill exactly.

If the Todo queue is empty, say so and stop.

---

## When done

Print a terse summary: which issues were **shipped to main** (with the single deploy SHA), which
Done branches were **skipped** (and why), and which Todo issues are now **Ready for Review** (with
review links) or were blocked.

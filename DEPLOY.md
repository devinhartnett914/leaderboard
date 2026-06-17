# Deploying Leaderboard to Netlify

Everything is built and committed. This is the ~5-minute, one-time setup to put the site on the
internet. The site is **public to view**; editing is locked behind an admin token.

## Before you start
- GitHub repo: `github.com/devinhartnett914/leaderboard` (code is pushed and ready)
- Supabase project: already set up and seeded with the real data

## Step 1 — Import the repo into Netlify
1. Go to https://app.netlify.com → **Add new site** → **Import an existing project**
2. Choose **GitHub**, authorize if asked, and pick the **`leaderboard`** repository
3. Netlify auto-detects Astro. Leave the defaults:
   - Build command: `npm run build`
   - The `@astrojs/netlify` adapter handles the server/functions automatically
4. **Don't click Deploy yet** — add the environment variables first (Step 2).

## Step 2 — Add environment variables
In the deploy screen (or later under **Site configuration → Environment variables**), add these
**five** variables. The values are in the local `.env` file on the Mac mini (Claude has them and
will paste them to you):

| Variable | What it is |
|----------|-----------|
| `PUBLIC_SUPABASE_URL` | Supabase project URL (browser-safe) |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (server only) |
| `ANTHROPIC_API_KEY` | Anthropic key, for future non-TriSignup scraping (server only) |
| `ADMIN_TOKEN` | Gate for the `/api/import` write endpoint (server only) |

> The three "server only" values are secrets. They live only in `.env` (gitignored) and in
> Netlify — never in the repo.

## Step 3 — Deploy
Click **Deploy**. Netlify builds and gives you a URL like `https://<name>.netlify.app`.
Open it — you should see the home page with Devin's races, and the year-over-year pages.

## Step 4 — Custom domain (optional, later)
Site configuration → **Domain management** → add a custom domain such as
`races.devinhartnett.com` (DNS for the parent already points to Netlify).

## How updates work after this
- The **production branch is `main`**. Pushing to `main` triggers an automatic redeploy.
- Adding race data does **not** require a deploy — data lives in Supabase, so new results show up
  immediately without rebuilding the site.

// Mint a fresh Gmail refresh token for the swim-results poll.
//
// The poll authenticates with GMAIL_REFRESH_TOKEN in .env. Google expires that
// token (~7 days while the OAuth consent screen is in "Testing" publishing
// status), which silently stops the daily poll. Re-authorize with:
//
//   node scripts/gmail-auth.cjs            # prints the consent URL to open
//   node scripts/gmail-auth.cjs '<code>'   # exchanges the code, rewrites .env
//
// After approving in the browser you'll land on a "can't reach this site" page
// (redirect to http://localhost) — that's expected; the authorization code is
// in the address bar (the value after `code=`, before `&`). Paste it back.
const fs = require('fs');
const ENV = '/Users/clawdnett/Projects/leaderboard/.env';
const env = fs.readFileSync(ENV, 'utf8');
const v = (k) => ((env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1] || '').replace(/^["']|["']$/g, '').trim();
const CID = v('GMAIL_CLIENT_ID'), CS = v('GMAIL_CLIENT_SECRET');
// Must exactly match a redirect URI registered on the OAuth client. Override
// with GMAIL_REDIRECT=... when the client registers a different one.
const REDIRECT = process.env.GMAIL_REDIRECT || 'http://localhost';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
// The mailbox the Glade swim-results emails are delivered to. Pre-selects the
// right account on the consent screen (override with GMAIL_ACCOUNT=... if needed).
const HINT = process.env.GMAIL_ACCOUNT || 'dcmjhartnett@gmail.com';

if (!CID || !CS) { console.error('Missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET in .env'); process.exit(1); }

const code = process.argv[2];
if (!code) {
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: CID, redirect_uri: REDIRECT, response_type: 'code',
    scope: SCOPE, access_type: 'offline', prompt: 'consent', login_hint: HINT,
  });
  console.log(url);
  process.exit(0);
}

(async () => {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID, client_secret: CS, code: code.trim(), redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
  });
  const j = await r.json();
  if (!j.refresh_token) { console.error('No refresh_token returned:', JSON.stringify(j)); process.exit(1); }
  let out = fs.readFileSync(ENV, 'utf8');
  out = /^GMAIL_REFRESH_TOKEN=.*$/m.test(out)
    ? out.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, 'GMAIL_REFRESH_TOKEN=' + j.refresh_token)
    : out.replace(/\n*$/, '\n') + 'GMAIL_REFRESH_TOKEN=' + j.refresh_token + '\n';
  fs.writeFileSync(ENV, out);
  console.log('OK: wrote new GMAIL_REFRESH_TOKEN (len ' + j.refresh_token.length + '). Daily poll can now authenticate.');
})();

// Download Glade meet-RESULTS PDFs via the Gmail API, run the proven pipeline
// (de-column pdftotext -> deterministic parser -> roster match), and either
// preview (dry) or ingest (live).  usage: node swim-backfill.cjs [dry|live]
//
//   - Roster comes from the DB (person.is_family), not a hardcoded list, so
//     adding a kid's profile is all it takes to capture them.
//   - SWIM_SINCE_DAYS=N limits the Gmail scan to the last N days (the daily
//     poll sets this so it doesn't re-scan the whole archive every run; omit it
//     for a full backfill).
//   - Each meet reports NEAR-MISSES: swimmers who share a family surname (or are
//     a typo away from a roster name) but didn't exactly match — so a nickname /
//     misspelling shows up as a line to check instead of a silently dropped kid.
const fs = require('fs');
const { execFileSync } = require('child_process');
const MODE = process.argv[2] === 'live' ? 'live' : 'dry';

const env = fs.readFileSync('/Users/clawdnett/Projects/leaderboard/.env', 'utf8');
const v = (k) => ((env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1] || process.env[k] || '').replace(/^["']|["']$/g, '').trim();
const CID = v('GMAIL_CLIENT_ID'), CS = v('GMAIL_CLIENT_SECRET'), RT = v('GMAIL_REFRESH_TOKEN');
const LABEL = 'Label_1841246710523545099';
const PT = '/opt/homebrew/bin/pdftotext', PI = '/opt/homebrew/bin/pdfinfo';
const SINCE_DAYS = parseInt(process.env.SWIM_SINCE_DAYS || '', 10);

const { createClient } = require('/Users/clawdnett/Projects/leaderboard/node_modules/@supabase/supabase-js');
const supa = createClient(v('PUBLIC_SUPABASE_URL'), v('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

// Levenshtein distance — used to flag a results name that's a typo away from a
// roster name (e.g. "Hartnet" vs "Hartnett") as a near-miss worth checking.
function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const normName = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// Roster names that DIDN'T exactly match but look like they should have:
// same family surname, or a 1–2 char typo away from a roster name.
function nearMisses(meet, roster) {
  const rosterNorms = roster.map((p) => normName(p.full_name));
  const familyLast = new Set(rosterNorms.map((n) => n.split(' ').pop()));
  const names = new Map(); // norm -> raw "Last, First"
  for (const ev of meet.events) for (const e of ev.entries) {
    if (e.kind === 'indiv') names.set(e.name.norm, e.name.raw);
    else for (const leg of e.legs) names.set(leg.name.norm, leg.name.raw);
  }
  const out = [];
  for (const [norm, raw] of names) {
    if (rosterNorms.includes(norm)) continue; // exact roster member (already matched)
    const surname = norm.split(' ').pop();
    const typo = rosterNorms.find((rn) => lev(rn, norm) <= 2);
    if (familyLast.has(surname)) out.push(`${raw} — shares family surname "${surname}"`);
    else if (typo) out.push(`${raw} — 1–2 chars off roster name "${typo}"`);
  }
  return out;
}

const { parseHytekMeet } = require('/tmp/swimsave/swim/hytek.js');
const { matchRoster } = require('/tmp/swimsave/swim/match.js');
const { ingestMeet } = require('/tmp/swimsave/swim/ingest.js');

// team senders only (skip swim-lesson + misc), and skip obvious non-results PDFs
const TEAM_SENDER = /rstagd@(teamunify|gomotionapp)\.com/i;
const NOT_RESULTS = /program|psych|entr|handout|schedule|descript|flyer|drive|policies|backpack|clothing|withdrawal|parent|info/i;
const SKIP_SUBJECT = /meet info|meet sheets/i; // pre-meet emails (programs/psych/entries), not results

async function accessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID, client_secret: CS, refresh_token: RT, grant_type: 'refresh_token' }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token: ' + JSON.stringify(j));
  return j.access_token;
}
let AT;
const api = async (path) => (await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + path, { headers: { Authorization: 'Bearer ' + AT } })).json();
async function download(msgId, attId) {
  const j = await api(`messages/${msgId}/attachments/${attId}`);
  return Buffer.from(j.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function pdfToTexts(buf) {
  fs.writeFileSync('/tmp/bf.pdf', buf);
  const info = execFileSync(PI, ['/tmp/bf.pdf'], { encoding: 'utf8' });
  const pages = +(info.match(/Pages:\s+(\d+)/) || [])[1];
  const width = +(info.match(/Page size:\s+([\d.]+)/) || [])[1] || 612;
  const half = Math.round(width / 2);
  // header from a full-width pass
  execFileSync(PT, ['-layout', '/tmp/bf.pdf', '/tmp/bf-full.txt']);
  const full = fs.readFileSync('/tmp/bf-full.txt', 'utf8');
  const hdr = [
    (full.match(/^[ \t]*Reston Swim League.*$/m) || [''])[0].trim(),
    (full.match(/^[ \t]*RSTA .*-.*20\d\d.*$/m) || [''])[0].trim(),
  ].filter(Boolean).join('\n');
  // Always produce BOTH a full-width read and a de-columned read; the caller
  // parses each and keeps whichever yields more results. Robust to single- vs
  // two-column layouts with no fragile heuristic.
  let decolBody = '';
  for (let p = 1; p <= pages; p++) {
    decolBody += execFileSync(PT, ['-layout', '-f', String(p), '-l', String(p), '-x', '0', '-y', '0', '-W', String(half), '-H', '900', '/tmp/bf.pdf', '-'], { encoding: 'utf8' });
    decolBody += execFileSync(PT, ['-layout', '-f', String(p), '-l', String(p), '-x', String(half), '-y', '0', '-W', String(half), '-H', '900', '/tmp/bf.pdf', '-'], { encoding: 'utf8' });
  }
  // pdftotext sometimes drops f-ligatures (fl/fi/ff); normalize so "Butterfly"
  // doesn't become "Butter ly" (which would corrupt the event name).
  const fix = (s) => s.replace(/ﬀ/g, 'ff').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').replace(/Butter\s+ly/gi, 'Butterfly');
  return { full: fix(hdr + '\n' + full), decol: fix(hdr + '\n' + decolBody) };
}

const fmt = (s) => (s == null ? 'DQ/—' : s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}` : s.toFixed(2));

(async () => {
  AT = await accessToken();
  // load the family roster from the DB (is_family) — same source live ingest uses
  const { data: rosterRows, error: rErr } = await supa.from('person').select('id, full_name').eq('is_family', true);
  if (rErr) throw new Error('roster load: ' + rErr.message);
  const roster = rosterRows || [];
  console.log(`Roster (${roster.length}): ${roster.map((p) => p.full_name).join(', ')}`);

  // enumerate candidate result emails (optionally only the last SWIM_SINCE_DAYS)
  const q = 'has:attachment filename:pdf' + (SINCE_DAYS > 0 ? ` newer_than:${SINCE_DAYS}d` : '');
  if (SINCE_DAYS > 0) console.log(`Scanning the last ${SINCE_DAYS} days only.`);
  let pageToken = '', ids = [];
  do {
    const res = await api(`messages?labelIds=${LABEL}&q=${encodeURIComponent(q)}&maxResults=100` + (pageToken ? `&pageToken=${pageToken}` : ''));
    (res.messages || []).forEach((m) => ids.push(m.id));
    pageToken = res.nextPageToken || '';
  } while (pageToken);

  const jobs = [];
  for (const id of ids) {
    const full = await api(`messages/${id}?format=full`);
    const h = {}; (full.payload?.headers || []).forEach((x) => (h[x.name] = x.value));
    const from = (h.From || '').replace(/.*<|>.*/g, '');
    if (!TEAM_SENDER.test(from)) continue;
    if (SKIP_SUBJECT.test(h.Subject || '')) continue;
    const pdfs = [];
    (function walk(p) { if (!p) return; if (p.filename && /\.pdf$/i.test(p.filename) && !NOT_RESULTS.test(p.filename)) pdfs.push({ filename: p.filename, attachmentId: p.body?.attachmentId }); (p.parts || []).forEach(walk); })(full.payload);
    for (const pdf of pdfs) jobs.push({ id, emailDate: new Date(h.Date).toISOString().slice(0, 10), subject: h.Subject, from, ...pdf });
  }
  console.log(`Result-PDF candidates: ${jobs.length}  (mode=${MODE})\n`);

  let missTotal = 0;
  for (const job of jobs) {
    try {
      const buf = await download(job.id, job.attachmentId);
      const { full, decol } = pdfToTexts(buf);
      const mFull = parseHytekMeet(full), mDecol = parseHytekMeet(decol);
      const entryCount = (m) => m.events.reduce((n, e) => n + e.entries.length, 0);
      const useDecol = entryCount(mDecol) > entryCount(mFull);
      const meet = useDecol ? mDecol : mFull;          // keep the read with more results
      if (!meet.date) meet.date = job.emailDate;       // fallback to email date
      if (!meet.meetCode) meet.meetCode = job.filename.replace(/\.pdf$/i, '').replace(/_/g, ' ');
      const matched = matchRoster(meet, roster);
      const counts = matched.filter((s) => s.individual.length || s.relays.length)
        .map((s) => `${s.person.full_name.split(' ')[0]}:${s.individual.length}i+${s.relays.length}r`).join(' ') || '(none)';
      const misses = nearMisses(meet, roster);
      console.log(`● ${meet.date}  code=${meet.meetCode}  events=${meet.events.length}  [${counts}]   (${job.filename})`);
      for (const s of matched) for (const r of s.individual) console.log(`     ${s.person.full_name.split(' ')[0]}  ${r.event} ${r.ageGroup} ${r.heat}  ${fmt(r.timeSeconds)} ${r.status}`);
      for (const s of matched) for (const rel of s.relays) console.log(`     ${s.person.full_name.split(' ')[0]}  ${rel.event} ${rel.team} ${fmt(rel.timeSeconds)}`);
      for (const m of misses) { console.log(`     ⚠️ possible miss: ${m}`); missTotal++; }
      if (MODE === 'live') {
        const sum = await ingestMeet(supa, meet, { sourceUrl: null });
        console.log(`     -> saved: ${sum.saved.map((x) => x.person.split(' ')[0] + ' ' + x.results).join(', ') || '(none)'}`);
      }
    } catch (e) {
      console.log(`✗ ${job.emailDate} ${job.filename}: ${e.message}`);
    }
  }
  if (missTotal) console.log(`\n⚠️ ${missTotal} near-miss name(s) above — check for a nickname or misspelling, then add/rename the person and re-run.`);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });

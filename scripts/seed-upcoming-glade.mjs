// One-off seed: the upcoming Glade Dolphins swim meets (Sierra & Aurora's team),
// pulled from the team Google calendar (restongladedolphins@gmail.com). Each meet is
// a swim_meet `race` + a future-dated 2026 `race_edition` with NO results yet — so it
// shows in the "Upcoming" module until results land. Additive + idempotent (upserts).
//
// Run:      node scripts/seed-upcoming-glade.mjs
// Rollback: delete from race_edition where host_platform = 'glade-dolphins-cal';
//           delete from race where slug in (...the 5 slugs below...);
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
	readFileSync(new URL('../.env', import.meta.url), 'utf8')
		.split('\n')
		.filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
		.map((l) => {
			const i = l.indexOf('=');
			return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
		}),
);
const url = env.PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
	console.error('Missing PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
	process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const TAG = 'glade-dolphins-cal';
const GLADE = 'Glade Pool, Reston, VA';
const NEWPORT = 'Lake Newport Pool, Reston, VA';
const base = 'https://www.google.com/calendar/event?eid=';
const meets = [
	{ slug: 'lake-anne-at-glade', name: 'Lake Anne @ Glade', date: '2026-06-27', location: GLADE, eid: 'MDdkM2h1NDRub2JvMWkzb2JzNjFqYW90Y3MgcmVzdG9uZ2xhZGVkb2xwaGluc0Bt' },
	{ slug: 'glade-at-north-hills', name: 'Glade @ North Hills', date: '2026-07-11', location: NEWPORT, eid: 'MGxyYm5sNW5maXNxbDYzZHRscnNmYWNjc2IgcmVzdG9uZ2xhZGVkb2xwaGluc0Bt' },
	{ slug: 'glade-im-meet', name: 'IM Meet', date: '2026-07-15', location: NEWPORT, eid: 'MmxuaDd1ZWZuMmZmbnRlNmNtN2doYnZhZHIgcmVzdG9uZ2xhZGVkb2xwaGluc0Bt' },
	{ slug: 'ridge-heights-at-glade', name: 'Ridge Heights @ Glade', date: '2026-07-18', location: GLADE, eid: 'MXE3anNvaXNtNzFlbzNsOWk4c3I5ZzZtOGggcmVzdG9uZ2xhZGVkb2xwaGluc0Bt' },
	{ slug: 'glade-all-star-meet', name: 'All-Star Meet', date: '2026-07-25', location: NEWPORT, eid: 'NjBxOW5zb3FpbDZraWdiM3JlYW52YjN0b24gcmVzdG9uZ2xhZGVkb2xwaGluc0Bt' },
];

const { data: races, error: rErr } = await db
	.from('race')
	.upsert(
		meets.map((m) => ({
			name: m.name,
			slug: m.slug,
			sport: 'swim_meet',
			location: m.location,
			description: 'Glade Dolphins swim meet (upcoming — seeded from the team calendar).',
		})),
		{ onConflict: 'slug' },
	)
	.select();
if (rErr) { console.error('race upsert failed:', rErr); process.exit(1); }
const idBySlug = Object.fromEntries(races.map((r) => [r.slug, r.id]));

const { data: eds, error: eErr } = await db
	.from('race_edition')
	.upsert(
		meets.map((m) => ({
			race_id: idBySlug[m.slug],
			year: 2026,
			date: m.date,
			source_url: base + m.eid,
			host_platform: TAG,
		})),
		{ onConflict: 'race_id,year' },
	)
	.select();
if (eErr) { console.error('edition upsert failed:', eErr); process.exit(1); }

console.log(`Seeded ${races.length} races + ${eds.length} upcoming editions:`);
for (const m of meets) console.log(`  ${m.date}  ${m.name}  →  /races/${m.slug}`);

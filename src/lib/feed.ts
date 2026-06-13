// Shared result-feed logic — used by the person page AND the all-races feed so they
// group, sort, and badge results identically. Everything is keyed per-person, so the
// same functions work whether the input is one person's results or the whole family's.
import type { ResultWithEdition } from './queries';
import { parseSwimEvent, swimEventKey } from './format';

// A result row that may carry its person (the feed) or not (a person's own page).
export type FeedRow = ResultWithEdition & {
	person?: { id: string; full_name: string; slug: string | null; avatar_url: string | null } | null;
};

export const isSwim = (r: FeedRow) => (r.race_edition?.race?.sport ?? 'other') === 'swim_meet';
export const sortKey = (r: FeedRow) => r.race_edition?.date ?? `${r.race_edition?.year ?? 0}-00-00`;
const courseOf = (r: FeedRow) => (r.race_edition?.distance_or_format ?? '').split(/\s+/)[0] || null;
export const swimCs = (r: FeedRow) => r.finish_time_cs ?? (r.finish_time_seconds != null ? r.finish_time_seconds * 100 : null);
/** group key so PRs/meets are computed per person (constant on a single-person page). */
const pid = (r: FeedRow) => r.person?.id ?? '@self';

/** Division podium (top-3) place if any, else null. */
export function podiumPlace(r: FeedRow): number | null {
	if (r.division_place != null && r.division_place <= 3) return r.division_place;
	if (r.overall_place != null && r.overall_place <= 3) return r.overall_place;
	return null;
}
/** Podium medallion info: division podium wins, else overall. */
export function award(r: FeedRow): { tier: number; sub: string } | null {
	if (r.division_place != null && r.division_place <= 3) return { tier: r.division_place, sub: r.division ?? 'Division' };
	if (r.overall_place != null && r.overall_place <= 3) return { tier: r.overall_place, sub: 'Overall' };
	return null;
}

/**
 * The "headline" event of a multi-event entry (a swim meet, later a ski race):
 * the standout to surface when collapsing the whole event into one summary card.
 * Ranked by best division place, then best overall place, then fastest time — so
 * a 1st-in-division beats a faster swim that placed lower. Finished events only.
 */
export function bestEvent(events: FeedRow[]): FeedRow | null {
	const finished = events.filter((e) => e.status === 'finished');
	if (!finished.length) return null;
	const rank = (e: FeedRow): [number, number, number] => [
		e.division_place ?? Infinity,
		e.overall_place ?? Infinity,
		swimCs(e) ?? Infinity,
	];
	return [...finished].sort((a, b) => {
		const ra = rank(a);
		const rb = rank(b);
		return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
	})[0];
}

export type PrBadge = { gold: boolean; label: string };

/** Per-person PR context: tells each result whether it's a PR (and the swim per-event best). */
export interface PrContext {
	prBadge: (r: FeedRow) => PrBadge | null; // tri/run PR (distance PR / series PR)
	isSwimPr: (r: FeedRow) => boolean; // swim per-event best
}

function runDistance(r: FeedRow): string | null {
	const sport = r.race_edition?.race?.sport;
	if (sport !== 'road_run' && sport !== 'trail_run') return null;
	const s = `${r.race_edition?.distance_or_format ?? ''} ${r.race_edition?.race?.name ?? ''}`.toLowerCase();
	if (/\bhalf\b|13\.1/.test(s)) return 'Half';
	if (/\bmarathon\b|26\.2/.test(s)) return 'Marathon';
	if (/\b5k\b/.test(s)) return '5K';
	if (/\b10k\b/.test(s)) return '10K';
	if (/\b15k\b/.test(s)) return '15K';
	if (/\b8k\b/.test(s)) return '8K';
	if (/five mile|\b5 ?mile/.test(s)) return '5 Mile';
	if (/ten mile|\b10 ?mile/.test(s)) return '10 Mile';
	if (/one mile|\b1 ?mile/.test(s)) return '1 Mile';
	return null;
}
const distKey = (r: FeedRow) => {
	const d = runDistance(r);
	return d ? `${pid(r)}|${r.race_edition?.race?.sport}|${d}` : null;
};

export function buildPrContext(results: FeedRow[]): PrContext {
	// swim per-event best (course + distance + stroke, per person)
	const prByEventKey = new Map<string, number>();
	for (const r of results) {
		if (!isSwim(r) || r.status !== 'finished') continue;
		const cs = swimCs(r);
		if (cs == null) continue;
		const k = `${pid(r)}|${swimEventKey(r.event, courseOf(r))}`;
		const best = prByEventKey.get(k);
		if (best == null || cs < best) prByEventKey.set(k, cs);
	}
	// per-series best (best at this recurring race) + how many times raced it (per person)
	const prByRace = new Map<string, number>();
	const countByRace = new Map<string, number>();
	for (const r of results) {
		if (isSwim(r)) continue;
		const raceId = r.race_edition?.race?.id;
		if (!raceId || r.status !== 'finished' || r.finish_time_seconds == null) continue;
		const rk = `${pid(r)}|${raceId}`;
		countByRace.set(rk, (countByRace.get(rk) ?? 0) + 1);
		const best = prByRace.get(rk);
		if (best == null || r.finish_time_seconds < best) prByRace.set(rk, r.finish_time_seconds);
	}
	// true distance PR (fastest 5K/10K/Half… across every series, per person)
	const prByDist = new Map<string, number>();
	for (const r of results) {
		const k = distKey(r);
		if (!k || r.status !== 'finished' || r.finish_time_seconds == null) continue;
		const best = prByDist.get(k);
		if (best == null || r.finish_time_seconds < best) prByDist.set(k, r.finish_time_seconds);
	}

	return {
		isSwimPr: (r) => {
			if (r.status !== 'finished') return false;
			const cs = swimCs(r);
			return cs != null && prByEventKey.get(`${pid(r)}|${swimEventKey(r.event, courseOf(r))}`) === cs;
		},
		prBadge: (r) => {
			if (r.status !== 'finished' || r.finish_time_seconds == null) return null;
			const raceId = r.race_edition?.race?.id;
			const sport = r.race_edition?.race?.sport;
			const t = r.finish_time_seconds;
			const k = distKey(r);
			const dist = runDistance(r);
			if (k && prByDist.get(k) === t) return { gold: true, label: `${dist} PR` };
			const rk = raceId != null ? `${pid(r)}|${raceId}` : null;
			const recurring = rk != null && (countByRace.get(rk) ?? 0) >= 2;
			if (recurring && rk != null && prByRace.get(rk) === t) {
				return k ? { gold: false, label: 'Series PR' } : { gold: true, label: 'PR' };
			}
			if (sport !== 'road_run' && sport !== 'trail_run' && rk != null && prByRace.get(rk) === t) {
				return { gold: true, label: 'PR' };
			}
			return null;
		},
	};
}

// ---- Feed entries: tri/run = one card per result; swim = one card per (person, meet);
// with groupRaces, a non-swim edition done by 2+ family members becomes one shared card.
export type CardEntry = { type: 'card'; r: FeedRow; date: string };
export type MeetEntry = { type: 'meet'; key: string; events: FeedRow[]; date: string };
export type RaceEntry = { type: 'race'; key: string; results: FeedRow[]; date: string };
export type Entry = CardEntry | MeetEntry | RaceEntry;

// Fastest finisher first; non-finishers (DNF/DNS/DQ) sink to the bottom.
const byFinish = (a: FeedRow, b: FeedRow) => {
	const t = (r: FeedRow) => (r.status === 'finished' ? r.finish_time_seconds ?? Infinity : Infinity);
	return t(a) - t(b);
};

const STROKE_ORDER: Record<string, number> = { free: 0, back: 1, breast: 2, fly: 3, im: 4, other: 5 };
export const eventOrder = (r: FeedRow) => {
	const ev = parseSwimEvent(r.event);
	return (ev.isRelay ? 1000 : 0) + (STROKE_ORDER[ev.strokeKey] ?? 9) * 100 + (ev.distance ?? 0) / 100;
};

/**
 * Group swim results into one meet entry per (person, edition); everything else is a
 * card. With `groupRaces`, a non-swim edition that 2+ family members ran collapses
 * into a single shared `race` entry (one card listing each finisher). Newest first.
 */
export function buildEntries(results: FeedRow[], opts: { groupRaces?: boolean } = {}): Entry[] {
	const entries: Entry[] = [];
	const swimByMeet = new Map<string, FeedRow[]>();
	const raceByEdition = new Map<string, FeedRow[]>(); // non-swim, grouped per edition when groupRaces
	for (const r of results) {
		if (isSwim(r)) {
			const k = `${pid(r)}|${r.race_edition_id}`;
			(swimByMeet.get(k) ?? swimByMeet.set(k, []).get(k)!).push(r);
		} else if (opts.groupRaces && r.race_edition_id) {
			const k = r.race_edition_id;
			(raceByEdition.get(k) ?? raceByEdition.set(k, []).get(k)!).push(r);
		} else {
			entries.push({ type: 'card', r, date: sortKey(r) });
		}
	}
	for (const [key, evs] of swimByMeet) {
		const sorted = [...evs].sort((a, b) => eventOrder(a) - eventOrder(b));
		entries.push({ type: 'meet', key, events: sorted, date: sortKey(sorted[0]) });
	}
	for (const [key, rs] of raceByEdition) {
		const distinctPeople = new Set(rs.map((r) => r.person?.id ?? r.id)).size;
		if (distinctPeople >= 2) {
			const sorted = [...rs].sort(byFinish);
			entries.push({ type: 'race', key, results: sorted, date: sortKey(sorted[0]) });
		} else {
			for (const r of rs) entries.push({ type: 'card', r, date: sortKey(r) });
		}
	}
	entries.sort((a, b) => b.date.localeCompare(a.date));
	return entries;
}

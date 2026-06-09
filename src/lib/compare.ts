import type { Person, RaceEdition, Result, Split } from './types';
import type { EditionWithResults, ResultWithEdition } from './queries';

// ---- Year-over-year tracks for family members ------------------------------

export interface YearCell {
	year: number;
	edition: RaceEdition;
	result: Result | null; // null if this family member didn't race that year
	splits: Split[];
}

export interface FamilyTrack {
	person: Person;
	cells: YearCell[]; // one per edition year, ascending
	prSeconds: number | null; // best finish time across all years
	prYear: number | null;
}

/** All distinct split labels seen across a track, in first-seen order (Swim/Bike/Run, laps, etc.). */
export function splitLabels(track: FamilyTrack): string[] {
	const seen: string[] = [];
	for (const cell of track.cells) {
		for (const s of cell.splits) if (!seen.includes(s.label)) seen.push(s.label);
	}
	return seen;
}

/**
 * Build one YoY track per family member from a race's editions.
 * Only family members (is_family) get a track; competitors feed the rivalry view.
 */
export function familyTracks(editions: EditionWithResults[]): FamilyTrack[] {
	const sortedEditions = [...editions].sort((a, b) => a.year - b.year);
	const byPerson = new Map<string, FamilyTrack>();

	for (const ed of sortedEditions) {
		for (const r of ed.result) {
			if (!r.person || !r.person.is_family || r.context !== 'family') continue;
			let track = byPerson.get(r.person.id);
			if (!track) {
				track = { person: r.person, cells: [], prSeconds: null, prYear: null };
				byPerson.set(r.person.id, track);
			}
			track.cells.push({ year: ed.year, edition: ed, result: r, splits: r.split ?? [] });
			if (r.status === 'finished' && r.finish_time_seconds != null) {
				if (track.prSeconds == null || r.finish_time_seconds < track.prSeconds) {
					track.prSeconds = r.finish_time_seconds;
					track.prYear = ed.year;
				}
			}
		}
	}

	// Fill missing years with empty cells so columns line up across the table.
	const years = sortedEditions.map((e) => e.year);
	for (const track of byPerson.values()) {
		const filled: YearCell[] = years.map((year) => {
			const existing = track.cells.find((c) => c.year === year);
			if (existing) return existing;
			const edition = sortedEditions.find((e) => e.year === year)!;
			return { year, edition, result: null, splits: [] };
		});
		track.cells = filled;
	}

	return [...byPerson.values()].sort((a, b) => a.person.full_name.localeCompare(b.person.full_name));
}

// ---- Recurring competitor / podium rivalry detection -----------------------

export interface DivisionRival {
	competitor: Person;
	years: number[]; // years this competitor shared the division with the family member
	bothPodiumYears: number[]; // subset where both were top-3 in the division
}

export interface FamilyRivalry {
	family: Person;
	division: string | null;
	rivals: DivisionRival[];
}

/**
 * For each family member, find competitors (non-family people) who showed up in
 * the SAME division across two or more years — the "on the podium with the same
 * people every year" insight. Requires that the family member's division results
 * and competitor rows (context podium/neighbor) were stored.
 */
export function recurringRivals(editions: EditionWithResults[]): FamilyRivalry[] {
	const out: FamilyRivalry[] = [];

	// Index family members and their division per edition.
	const familyEntries: { person: Person; division: string | null; year: number; podium: boolean }[] = [];
	for (const ed of editions) {
		for (const r of ed.result) {
			if (r.person?.is_family && r.context === 'family') {
				familyEntries.push({
					person: r.person,
					division: r.division,
					year: ed.year,
					podium: r.division_place != null && r.division_place <= 3,
				});
			}
		}
	}

	// Group family entries by person + division.
	const groups = new Map<string, { family: Person; division: string | null; years: number[]; podiumYears: Set<number> }>();
	for (const e of familyEntries) {
		const key = `${e.person.id}|${e.division ?? ''}`;
		let g = groups.get(key);
		if (!g) {
			g = { family: e.person, division: e.division, years: [], podiumYears: new Set() };
			groups.set(key, g);
		}
		g.years.push(e.year);
		if (e.podium) g.podiumYears.add(e.year);
	}

	for (const g of groups.values()) {
		// competitor id -> { person, years, podiumYears }
		const rivals = new Map<string, { competitor: Person; years: Set<number>; podiumYears: Set<number> }>();
		for (const ed of editions) {
			if (!g.years.includes(ed.year)) continue;
			for (const r of ed.result) {
				if (!r.person || r.person.is_family) continue; // competitors only
				if ((r.division ?? '') !== (g.division ?? '')) continue; // same division as the family member
				let rv = rivals.get(r.person.id);
				if (!rv) {
					rv = { competitor: r.person, years: new Set(), podiumYears: new Set() };
					rivals.set(r.person.id, rv);
				}
				rv.years.add(ed.year);
				if (r.division_place != null && r.division_place <= 3) rv.podiumYears.add(ed.year);
			}
		}

		const recurring: DivisionRival[] = [...rivals.values()]
			.filter((rv) => rv.years.size >= 2)
			.map((rv) => ({
				competitor: rv.competitor,
				years: [...rv.years].sort((a, b) => a - b),
				bothPodiumYears: [...rv.podiumYears].filter((y) => g.podiumYears.has(y)).sort((a, b) => a - b),
			}))
			.sort((a, b) => b.years.length - a.years.length);

		if (recurring.length > 0) {
			out.push({ family: g.family, division: g.division, rivals: recurring });
		}
	}

	return out;
}

// ---- Person-page helpers ---------------------------------------------------

export interface SportGroup {
	sport: string;
	results: ResultWithEdition[];
}

/** Group a person's results by sport (most results first), newest within each group. */
export function groupResultsBySport(results: ResultWithEdition[]): SportGroup[] {
	const map = new Map<string, ResultWithEdition[]>();
	for (const r of results) {
		const sport = r.race_edition?.race?.sport ?? 'other';
		if (!map.has(sport)) map.set(sport, []);
		map.get(sport)!.push(r);
	}
	return [...map.entries()]
		.map(([sport, results]) => ({ sport, results }))
		.sort((a, b) => b.results.length - a.results.length);
}

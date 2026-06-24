import { supabase } from './supabase';
import type { Person, Race, RaceEdition, Result, Split } from './types';

// ---- Composite shapes returned by nested Supabase selects ------------------

export interface ResultWithEdition extends Result {
	race_edition: (RaceEdition & { race: Race | null }) | null;
	split: Split[];
}

export interface ResultWithPerson extends Result {
	person: Person | null;
	split: Split[];
}

export interface EditionWithResults extends RaceEdition {
	result: ResultWithPerson[];
}

export interface PersonPageData {
	person: Person;
	results: ResultWithEdition[];
}

export interface RacePageData {
	race: Race;
	editions: EditionWithResults[];
}

// ---- Queries ---------------------------------------------------------------

export async function getFamilyMembers(): Promise<Person[]> {
	if (!supabase) return [];
	const { data, error } = await supabase
		.from('person')
		.select('*')
		.eq('is_family', true)
		.order('full_name');
	if (error) throw error;
	return data ?? [];
}

export async function getRaces(): Promise<Race[]> {
	if (!supabase) return [];
	const { data, error } = await supabase.from('race').select('*').order('name');
	if (error) throw error;
	return data ?? [];
}

/** A result with its edition/race AND the family member who ran it — for feeds. */
export interface FeedResult extends ResultWithEdition {
	person: Person | null;
}

/** Every family result, newest first — drives the all-races feed + "recent". */
export async function getAllFamilyResults(): Promise<FeedResult[]> {
	if (!supabase) return [];
	const { data, error } = await supabase
		.from('result')
		.select('*, person(*), race_edition(*, race(*)), split(*)')
		.eq('context', 'family');
	if (error) throw error;
	const rows = (data ?? []) as FeedResult[];
	for (const r of rows) r.split?.sort((a, b) => a.sequence - b.sequence);
	const dateKey = (r: FeedResult) => r.race_edition?.date ?? `${r.race_edition?.year ?? 0}-00-00`;
	return rows.sort((a, b) => dateKey(b).localeCompare(dateKey(a)));
}

/** The most recent family results across everyone. */
export async function getRecentResults(limit = 3): Promise<FeedResult[]> {
	return (await getAllFamilyResults()).slice(0, limit);
}

export interface UpcomingRace extends RaceEdition {
	race: Race | null;
	// Family members this upcoming meet is attributed to. A result-less upcoming
	// edition has no `result` row to link a person, so attribution is by sport: the
	// family members who compete in this edition's sport (e.g. the swimmers → the Glade
	// meets). One name renders as that person; 2+ render as avatars + "N Racers".
	racers: Person[];
}

/**
 * Race editions dated today or later, each tagged with the family members it's
 * attributed to (by sport — see `UpcomingRace.racers`). Once an edition's date passes
 * it drops out here and reappears in the results feed when its results are ingested.
 */
export async function getUpcomingRaces(limit = 8): Promise<UpcomingRace[]> {
	if (!supabase) return [];
	const today = new Date().toISOString().slice(0, 10);
	const { data, error } = await supabase
		.from('race_edition')
		.select('*, race(*)')
		.gte('date', today)
		.order('date', { ascending: true })
		.limit(limit);
	if (error) throw error;
	const editions = (data ?? []) as UpcomingRace[];

	// Build sport → family members from existing family results, then attribute each
	// upcoming edition to the family members who compete in its sport.
	const { data: famRows, error: fErr } = await supabase
		.from('result')
		.select('person(*), race_edition(race(sport))')
		.eq('context', 'family');
	if (fErr) throw fErr;
	const bySport = new Map<string, Map<string, Person>>();
	for (const row of (famRows ?? []) as Array<{ person: Person | null; race_edition: { race: { sport: string | null } | null } | null }>) {
		const sport = row.race_edition?.race?.sport;
		const person = row.person;
		if (!sport || !person?.is_family) continue;
		const m = bySport.get(sport) ?? new Map<string, Person>();
		m.set(person.id, person);
		bySport.set(sport, m);
	}
	for (const ed of editions) {
		const sport = ed.race?.sport;
		ed.racers = sport ? [...(bySport.get(sport)?.values() ?? [])] : [];
	}
	return editions;
}

/** A family member + every result they have, newest edition first. */
export async function getPersonBySlug(slug: string): Promise<PersonPageData | null> {
	if (!supabase) return null;
	const { data: person, error: pErr } = await supabase
		.from('person')
		.select('*')
		.eq('slug', slug)
		.maybeSingle();
	if (pErr) throw pErr;
	if (!person) return null;

	const { data: results, error: rErr } = await supabase
		.from('result')
		.select('*, race_edition(*, race(*)), split(*)')
		.eq('person_id', person.id);
	if (rErr) throw rErr;

	const sorted = (results ?? []).sort(
		(a, b) => (b.race_edition?.year ?? 0) - (a.race_edition?.year ?? 0),
	);
	// splits already small; ensure they're ordered
	for (const r of sorted) r.split?.sort((a, b) => a.sequence - b.sequence);

	return { person, results: sorted as ResultWithEdition[] };
}

/** A recurring race + every edition (year) with all stored results + splits. */
export async function getRaceBySlug(slug: string): Promise<RacePageData | null> {
	if (!supabase) return null;
	const { data: race, error: raceErr } = await supabase
		.from('race')
		.select('*')
		.eq('slug', slug)
		.maybeSingle();
	if (raceErr) throw raceErr;
	if (!race) return null;

	const { data: editions, error: edErr } = await supabase
		.from('race_edition')
		.select('*, result(*, person(*), split(*))')
		.eq('race_id', race.id)
		.order('year', { ascending: true });
	if (edErr) throw edErr;

	for (const ed of editions ?? []) {
		for (const r of ed.result ?? []) r.split?.sort((a: Split, b: Split) => a.sequence - b.sequence);
	}

	return { race, editions: (editions ?? []) as EditionWithResults[] };
}

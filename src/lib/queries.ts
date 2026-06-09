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

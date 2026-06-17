// Save a parsed HY-TEK swim meet into trime.
//
// Model (no schema change vs the existing once-per-year design):
//   - one `race` per meet matchup (e.g. "AW@GL"), recurring annually
//   - one `race_edition` per year of that matchup
//   - one `result` per family swimmer per event (individual events AND relays)
//
// Roster-driven: loads the family from the DB (is_family) and saves only people
// it matches by name — adding a kid's profile is all it takes to capture them.
// Idempotent: re-running the same meet updates rows in place (keyed by
// edition + person + event), so a re-send of the same email never duplicates.
//
// The db client is INJECTED (not imported from supabase.ts) so this runs both
// inside Astro (API endpoint passes getServiceClient()) and from a standalone
// script (passes a process.env-built client) without import.meta issues.

import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '../util';
import type { ParsedMeet } from './hytek';
import { matchRoster, type RosterPerson } from './match';

export interface SwimIngestSummary {
	race: string;
	raceSlug: string;
	year: number;
	date: string | null;
	saved: { person: string; results: number }[];
	familyWithNoSwims: string[];
}

function meetRaceName(meet: ParsedMeet): string {
	// "AW@GL" -> "Reston Swim League: AW @ GL". Full team names aren't reliably
	// derivable from the 2-letter codes, so keep a stable code-based identity that
	// recurs the same way each year; the UI can prettify the display name.
	const code = meet.meetCode ?? 'meet';
	return `Reston Swim League: ${code.replace('@', ' @ ')}`;
}

function timesFor(timeSeconds: number | null) {
	// whole seconds for generic lists; hundredths for exact swim display
	return {
		finish_time_seconds: timeSeconds == null ? null : Math.round(timeSeconds),
		finish_time_cs: timeSeconds == null ? null : Math.round(timeSeconds * 100),
	};
}

async function ensureRace(
	db: SupabaseClient,
	name: string,
	slug: string,
	location: string,
): Promise<string> {
	const { data: existing } = await db.from('race').select('id').eq('slug', slug).maybeSingle();
	if (existing) return existing.id as string;
	const { data, error } = await db
		.from('race')
		.insert({ name, slug, sport: 'swim_meet', location })
		.select('id')
		.single();
	if (error) throw error;
	return data.id as string;
}

async function ensureEdition(
	db: SupabaseClient,
	raceId: string,
	year: number,
	date: string | null,
	sourceUrl: string | null,
	course: string,
): Promise<string> {
	const patch = {
		race_id: raceId,
		year,
		date,
		source_url: sourceUrl,
		host_platform: 'gomotion',
		distance_or_format: `${course} dual meet`,
	};
	const { data: existing } = await db
		.from('race_edition')
		.select('id')
		.eq('race_id', raceId)
		.eq('year', year)
		.maybeSingle();
	if (existing) {
		await db.from('race_edition').update(patch).eq('id', existing.id);
		return existing.id as string;
	}
	const { data, error } = await db.from('race_edition').insert(patch).select('id').single();
	if (error) throw error;
	return data.id as string;
}

/** Upsert a single result row keyed by (edition, person, event). */
async function upsertResultRow(
	db: SupabaseClient,
	editionId: string,
	personId: string,
	event: string,
	fields: Record<string, unknown>,
): Promise<void> {
	const patch = { race_edition_id: editionId, person_id: personId, event, context: 'family' as const, ...fields };
	const { data: existing } = await db
		.from('result')
		.select('id')
		.eq('race_edition_id', editionId)
		.eq('person_id', personId)
		.eq('event', event)
		.maybeSingle();
	if (existing) {
		await db.from('result').update(patch).eq('id', existing.id);
		return;
	}
	const { error } = await db.from('result').insert(patch);
	if (error) throw error;
}

export async function ingestMeet(
	db: SupabaseClient,
	meet: ParsedMeet,
	opts: { sourceUrl?: string | null } = {},
): Promise<SwimIngestSummary> {
	if (!meet.date) throw new Error('meet has no parseable date — cannot determine the edition year');
	const year = Number(meet.date.slice(0, 4));

	const { data: rosterRows } = await db.from('person').select('id, full_name').eq('is_family', true);
	const roster = (rosterRows ?? []) as (RosterPerson & { id: string })[];
	const matched = matchRoster(meet, roster);

	const name = meetRaceName(meet);
	const slug = slugify(name);

	// Only materialize the race/edition if a family member actually swam this
	// meet — don't leave empty shells for meets they missed or championships
	// they didn't qualify for.
	if (!matched.some((s) => s.individual.length || s.relays.length)) {
		return { race: name, raceSlug: slug, year, date: meet.date, saved: [], familyWithNoSwims: roster.map((r) => r.full_name) };
	}

	const raceId = await ensureRace(db, name, slug, 'Reston, VA');
	const editionId = await ensureEdition(db, raceId, year, meet.date, opts.sourceUrl ?? null, meet.course);

	const saved: { person: string; results: number }[] = [];
	const familyWithNoSwims: string[] = [];
	for (const sw of matched) {
		const personId = (sw.person as { id?: string }).id;
		if (!personId) continue;
		if (sw.individual.length === 0 && sw.relays.length === 0) {
			familyWithNoSwims.push(sw.person.full_name);
			continue;
		}
		for (const r of sw.individual) {
			await upsertResultRow(db, editionId, personId, r.event, {
				division: r.heat ? `${r.ageGroup} ${r.heat}` : r.ageGroup, // e.g. "9-10 C"
				division_place: r.place,
				status: r.status,
				...timesFor(r.timeSeconds),
			});
		}
		for (const rel of sw.relays) {
			const squad = rel.team.split(' ').pop() ?? ''; // "GL-VA C" -> "C"
			await upsertResultRow(db, editionId, personId, rel.event, {
				division: `${rel.ageGroup} ${squad}`.trim(), // e.g. "8 & Under C"
				division_place: rel.place,
				status: rel.status,
				...timesFor(rel.timeSeconds),
			});
		}
		saved.push({ person: sw.person.full_name, results: sw.individual.length + sw.relays.length });
	}

	return { race: name, raceSlug: slug, year, date: meet.date, saved, familyWithNoSwims };
}

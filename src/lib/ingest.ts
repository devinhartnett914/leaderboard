// Idempotent ingestion: take an athlete's extracted race (from a platform adapter)
// and upsert race / edition / result / split rows. Safe to re-run — it updates in place.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from './supabase';
import { slugify, normalizeName } from './util';
import type { ExtractedRace, ExtractedResult, ExtractedSplit } from './platforms/runsignup';
import type { Sport } from './types';

export interface AthleteInput {
	full_name: string;
	gender?: string | null;
	birth_year?: number | null;
	is_family?: boolean;
}

export interface IngestSummary {
	person: string;
	race: string;
	race_slug: string;
	years: number[];
	results: number;
	splits: number;
}

async function ensurePerson(db: SupabaseClient, athlete: AthleteInput): Promise<string> {
	const normalized = normalizeName(athlete.full_name);
	const { data: existing } = await db
		.from('person')
		.select('id, slug')
		.eq('normalized_name', normalized)
		.maybeSingle();

	if (existing) {
		await db
			.from('person')
			.update({
				gender: athlete.gender ?? null,
				birth_year: athlete.birth_year ?? null,
				is_family: athlete.is_family ?? true,
			})
			.eq('id', existing.id);
		return existing.id as string;
	}

	const slug = athlete.is_family === false ? null : slugify(athlete.full_name);
	const { data, error } = await db
		.from('person')
		.insert({
			full_name: athlete.full_name,
			normalized_name: normalized,
			slug,
			is_family: athlete.is_family ?? true,
			gender: athlete.gender ?? null,
			birth_year: athlete.birth_year ?? null,
		})
		.select('id')
		.single();
	if (error) throw error;
	return data.id as string;
}

async function ensureRace(
	db: SupabaseClient,
	race: { name: string; sport: Sport; location: string | null },
): Promise<{ id: string; slug: string }> {
	const slug = slugify(race.name);
	const { data: existing } = await db.from('race').select('id, slug').eq('slug', slug).maybeSingle();
	if (existing) return { id: existing.id as string, slug: existing.slug as string };

	const { data, error } = await db
		.from('race')
		.insert({ name: race.name, slug, sport: race.sport, location: race.location })
		.select('id, slug')
		.single();
	if (error) throw error;
	return { id: data.id as string, slug: data.slug as string };
}

async function ensureEdition(db: SupabaseClient, raceId: string, r: ExtractedResult): Promise<string> {
	const patch = {
		race_id: raceId,
		year: r.year,
		date: r.date,
		source_url: r.source_url,
		host_platform: 'trisignup',
		distance_or_format: r.distance_or_format,
	};
	const { data: existing } = await db
		.from('race_edition')
		.select('id')
		.eq('race_id', raceId)
		.eq('year', r.year)
		.maybeSingle();
	if (existing) {
		await db.from('race_edition').update(patch).eq('id', existing.id);
		return existing.id as string;
	}
	const { data, error } = await db.from('race_edition').insert(patch).select('id').single();
	if (error) throw error;
	return data.id as string;
}

async function upsertResult(
	db: SupabaseClient,
	editionId: string,
	personId: string,
	r: ExtractedResult,
): Promise<string> {
	const patch = {
		race_edition_id: editionId,
		person_id: personId,
		event: null,
		finish_time_seconds: r.finish_time_seconds,
		overall_place: r.overall_place,
		overall_field_size: r.overall_field_size,
		division: r.division,
		division_place: r.division_place,
		division_size: r.division_size,
		gender_place: null,
		bib: r.bib,
		status: r.status,
		context: 'family' as const,
	};
	const { data: existing } = await db
		.from('result')
		.select('id')
		.eq('race_edition_id', editionId)
		.eq('person_id', personId)
		.is('event', null)
		.maybeSingle();
	if (existing) {
		await db.from('result').update(patch).eq('id', existing.id);
		return existing.id as string;
	}
	const { data, error } = await db.from('result').insert(patch).select('id').single();
	if (error) throw error;
	return data.id as string;
}

async function replaceSplits(db: SupabaseClient, resultId: string, splits: ExtractedSplit[]): Promise<void> {
	await db.from('split').delete().eq('result_id', resultId);
	if (splits.length === 0) return;
	const rows = splits.map((s) => ({
		result_id: resultId,
		sequence: s.sequence,
		label: s.label,
		segment_type: s.segment_type,
		segment_time_seconds: s.segment_time_seconds,
		cumulative_time_seconds: s.cumulative_time_seconds,
	}));
	const { error } = await db.from('split').insert(rows);
	if (error) throw error;
}

export async function ingestExtractedRace(
	extracted: ExtractedRace,
	athlete: AthleteInput,
	opts: { raceNameOverride?: string } = {},
): Promise<IngestSummary> {
	const db = getServiceClient();
	const personId = await ensurePerson(db, athlete);
	const raceName = opts.raceNameOverride ?? extracted.name;
	const race = await ensureRace(db, {
		name: raceName,
		sport: extracted.sport,
		location: extracted.location,
	});

	let splits = 0;
	const years: number[] = [];
	for (const r of extracted.results) {
		const editionId = await ensureEdition(db, race.id, r);
		const resultId = await upsertResult(db, editionId, personId, r);
		await replaceSplits(db, resultId, r.splits);
		splits += r.splits.length;
		years.push(r.year);
	}

	return {
		person: athlete.full_name,
		race: raceName,
		race_slug: race.slug,
		years: years.sort((a, b) => a - b),
		results: extracted.results.length,
		splits,
	};
}

// Database row types — mirror supabase/migrations/0001_init.sql

export type Sport = 'triathlon' | 'swim_meet' | 'gravel' | 'trail_run' | 'road_run' | 'other';
export type ResultStatus = 'finished' | 'dnf' | 'dns' | 'dq';
export type ResultContext = 'family' | 'podium' | 'neighbor';
export type SegmentType = 'leg' | 'lap' | 'distance' | 'checkpoint';

export interface Person {
	id: string;
	full_name: string;
	normalized_name: string;
	slug: string | null;
	is_family: boolean;
	birth_year: number | null;
	gender: string | null;
	avatar_url: string | null;
	notes: string | null;
}

export interface Race {
	id: string;
	name: string;
	slug: string;
	sport: Sport;
	location: string | null;
	description: string | null;
}

export interface RaceEdition {
	id: string;
	race_id: string;
	year: number;
	date: string | null;
	source_url: string | null;
	host_platform: string | null;
	distance_or_format: string | null;
	weather: string | null;
	name_override: string | null;
	notes: string | null;
}

export interface Result {
	id: string;
	race_edition_id: string;
	person_id: string;
	event: string | null;
	finish_time_seconds: number | null;
	overall_place: number | null;
	overall_field_size: number | null;
	division: string | null;
	division_place: number | null;
	division_size: number | null;
	gender_place: number | null;
	bib: string | null;
	status: ResultStatus;
	context: ResultContext;
}

export interface Split {
	id: string;
	result_id: string;
	sequence: number;
	label: string;
	segment_type: SegmentType;
	distance_m: number | null;
	distance_unit: string | null; // 'm' | 'yd' | 'mi' | 'km' — how to display this leg
	segment_time_seconds: number | null;
	cumulative_time_seconds: number | null;
}

// Human-friendly labels for sports
export const SPORT_LABELS: Record<Sport, string> = {
	triathlon: 'Triathlon',
	swim_meet: 'Swim Meet',
	gravel: 'Gravel',
	trail_run: 'Trail Run',
	road_run: 'Road Run',
	other: 'Other',
};

// RunSignup / TriSignup results adapter.
// Pulls structured results + splits straight from the public JSON API — no HTML
// scraping or LLM needed. Works for runsignup.com and trisignup.com result URLs.

import { parseDuration } from '../format';
import type { Sport } from '../types';

const API = 'https://runsignup.com/rest';
const UA = { 'User-Agent': 'Mozilla/5.0 (trime race tracker)' } as const;
const PAGE_SIZE = 50;

export interface ExtractedSplit {
	sequence: number;
	label: string;
	segment_type: 'leg' | 'lap' | 'distance' | 'checkpoint';
	segment_time_seconds: number | null;
	cumulative_time_seconds: number | null;
	distance_m: number | null;
	distance_unit: string | null; // 'mi' (bike) | 'km' (run) | set later for swim
}

const MILE_M = 1609.344;

/**
 * Back-calculate a leg's distance from RunSignup's pace column.
 * Bike pace is "17.3 mph"; run pace is "11:50" (min/mile). Swim has no pace.
 */
function deriveLegDistance(
	label: string,
	seconds: number,
	pace: string | undefined,
): { distance_m: number | null; distance_unit: string | null } {
	if (!pace) return { distance_m: null, distance_unit: null };
	if (/bike|cycle/i.test(label) || /mph/i.test(pace)) {
		const mph = parseFloat(pace);
		if (!Number.isFinite(mph) || mph <= 0) return { distance_m: null, distance_unit: null };
		return { distance_m: mph * (seconds / 3600) * MILE_M, distance_unit: 'mi' };
	}
	if (/run/i.test(label)) {
		const secPerMile = parseDuration(pace);
		if (!secPerMile || secPerMile <= 0) return { distance_m: null, distance_unit: null };
		return { distance_m: (seconds / secPerMile) * MILE_M, distance_unit: 'km' }; // store meters, show km
	}
	return { distance_m: null, distance_unit: null };
}

export interface ExtractedResult {
	year: number;
	date: string | null; // yyyy-mm-dd
	event_name: string;
	result_set_id: number;
	event_id: number;
	source_url: string;
	distance_or_format: string | null;
	finish_time_seconds: number | null;
	overall_place: number | null;
	overall_field_size: number | null;
	division: string | null;
	division_place: number | null;
	division_size: number | null;
	gender: string | null;
	age: number | null;
	bib: string | null;
	status: 'finished' | 'dnf' | 'dns' | 'dq';
	splits: ExtractedSplit[];
}

export interface ExtractedRace {
	platform: 'runsignup';
	race_id: number;
	name: string;
	sport: Sport;
	location: string | null;
	url: string;
	results: ExtractedResult[];
}

type Row = Record<string, unknown>;
type Headers = Record<string, string>;

export function parseRunsignupUrl(url: string): { raceId: number; resultSetId?: number } | null {
	const m = url.match(/\/Race\/Results\/(\d+)/i);
	if (!m) return null;
	const rs = url.match(/resultSetId=(\d+)/i);
	return { raceId: Number(m[1]), resultSetId: rs ? Number(rs[1]) : undefined };
}

async function apiGet(path: string): Promise<any> {
	const sep = path.includes('?') ? '&' : '?';
	const res = await fetch(`${API}${path}${sep}format=json`, { headers: UA });
	if (!res.ok) throw new Error(`RunSignup API ${res.status} for ${path}`);
	return res.json();
}

interface RsuEvent {
	event_id: number;
	name: string;
	start_time: string;
}

async function getRace(raceId: number): Promise<{ name: string; city: string | null; state: string | null; events: RsuEvent[] }> {
	const data = await apiGet(`/race/${raceId}?events=T`);
	const r = data.race ?? {};
	return {
		name: r.name ?? `Race ${raceId}`,
		city: r.address?.city ?? null,
		state: r.address?.state ?? null,
		events: r.events ?? [],
	};
}

async function getResultSets(raceId: number, eventId: number): Promise<{ id: number; name: string }[]> {
	const data = await apiGet(`/race/${raceId}/results/get-result-sets?event_id=${eventId}`);
	return (data.individual_results_sets ?? []).map((s: any) => ({
		id: s.individual_result_set_id,
		name: s.individual_result_set_name ?? '',
	}));
}

async function getAllResults(
	raceId: number,
	eventId: number,
	setId: number,
): Promise<{ rows: Row[]; headers: Headers }> {
	let page = 1;
	let rows: Row[] = [];
	let headers: Headers = {};
	let got = 0;
	do {
		const data = await apiGet(
			`/race/${raceId}/results/get-results?event_id=${eventId}&result_set_id=${setId}&page=${page}&results_per_page=${PAGE_SIZE}`,
		);
		const set = data.individual_results_sets?.[0];
		if (!set) break;
		headers = set.results_headers ?? headers;
		const pageRows: Row[] = set.results ?? [];
		got = pageRows.length;
		rows = rows.concat(pageRows);
		page++;
	} while (got === PAGE_SIZE && page <= 60);
	return { rows, headers };
}

function yearOf(startTime: string): number {
	const m = startTime.match(/(\d{4})/);
	if (m) return Number(m[1]);
	// fall back to m/d/yyyy
	const d = startTime.split(/[/\s]/).find((p) => p.length === 4);
	return d ? Number(d) : 0;
}

function isoDate(startTime: string): string | null {
	// "6/2/2024 07:00" -> "2024-06-02"
	const m = startTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (!m) return null;
	const [, mo, da, yr] = m;
	return `${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
}

function guessFormat(eventName: string): string | null {
	if (/sprint/i.test(eventName)) return 'Sprint';
	if (/olympic|intermediate/i.test(eventName)) return 'Olympic';
	if (/half|70\.?3/i.test(eventName)) return 'Half (70.3)';
	if (/full|140\.?6|ironman/i.test(eventName)) return 'Full (140.6)';
	// open-water / distance swims and similar: "1 Mile Swim" -> "1 Mile"
	const mile = eventName.match(/(\d+(?:\.\d+)?)\s*mile/i);
	if (mile) return `${mile[1]} Mile`;
	return null;
}

function guessSport(name: string): Sport {
	if (/triathlon|aquabike|duathlon/i.test(name)) return 'triathlon';
	if (/open water|\bows\b|lake swim|bay swim|river swim|reservoir swim/i.test(name)) return 'open_water';
	if (/swim|aquatic|meet/i.test(name)) return 'swim_meet';
	if (/gravel/i.test(name)) return 'gravel';
	if (/trail/i.test(name)) return 'trail_run';
	if (/run|5k|10k|marathon|mile/i.test(name)) return 'road_run';
	return 'triathlon';
}

/** Pull splits (SWIM/T1/BIKE/T2/RUN, laps, etc.) from a row using the header labels. */
function extractSplits(row: Row, headers: Headers): ExtractedSplit[] {
	const splitKeys = Object.keys(headers).filter((k) => /^split-\d+$/.test(k));
	const splits: ExtractedSplit[] = [];
	let cumulative = 0;
	let seq = 1;
	for (const key of splitKeys) {
		const seconds = parseDuration(row[key] as string);
		if (seconds == null) continue;
		cumulative += seconds;
		const label = headers[key] || `Split ${seq}`;
		const { distance_m, distance_unit } = deriveLegDistance(label, seconds, row[`${key}-pace`] as string | undefined);
		splits.push({
			sequence: seq++,
			label,
			segment_type: 'leg',
			segment_time_seconds: seconds,
			cumulative_time_seconds: cumulative,
			distance_m,
			distance_unit,
		});
	}
	return splits;
}

/** "F4044" -> "F40-44" (some races omit the dash); leaves "F40-44"/"F80+" as-is. */
function normalizeDivision(label: string): string {
	const m = label.match(/^([MF])(\d{2})(\d{2})$/);
	return m ? `${m[1]}${m[2]}-${m[3]}` : label;
}

/** Find the athlete's age-group division (e.g. "F40-44") and placement from the row. */
function extractDivision(
	row: Row,
	headers: Headers,
	allRows: Row[],
): { division: string | null; place: number | null; size: number | null } {
	const ageGroupKeys = Object.keys(headers).filter(
		(k) => /^division-\d+-placement$/.test(k) && /^[MF]\d/.test(headers[k]),
	);
	for (const key of ageGroupKeys) {
		const place = row[key];
		if (place != null) {
			const size = allRows.filter((r) => r[key] != null).length;
			return { division: normalizeDivision(headers[key]), place: Number(place), size };
		}
	}
	return { division: null, place: null, size: null };
}

function extractResult(
	row: Row,
	headers: Headers,
	allRows: Row[],
	event: RsuEvent,
	raceId: number,
	setId: number,
): ExtractedResult {
	const div = extractDivision(row, headers, allRows);
	const finish = parseDuration((row.chip_time as string) ?? (row.clock_time as string));
	return {
		year: yearOf(event.start_time),
		date: isoDate(event.start_time),
		event_name: event.name,
		event_id: event.event_id,
		result_set_id: setId,
		source_url: `https://runsignup.com/Race/Results/${raceId}/?resultSetId=${setId}`,
		distance_or_format: guessFormat(event.name),
		finish_time_seconds: finish,
		overall_place: row.place != null ? Number(row.place) : null,
		overall_field_size: allRows.length,
		division: div.division,
		division_place: div.place,
		division_size: div.size,
		gender: (row.gender as string) ?? null,
		age: row.age != null ? Number(row.age) : null,
		bib: row.bib != null ? String(row.bib) : null,
		status: finish && finish > 0 ? 'finished' : 'dnf',
		splits: extractSplits(row, headers),
	};
}

function nameMatches(row: Row, firstName: string, lastName: string): boolean {
	const f = String(row.first_name ?? '').trim().toLowerCase();
	const l = String(row.last_name ?? '').trim().toLowerCase();
	return f === firstName.trim().toLowerCase() && l === lastName.trim().toLowerCase();
}

/**
 * Find one athlete's results across every year of a RunSignup/TriSignup race.
 * Scans all events + result sets, matches by name, and returns one result per year
 * (preferring the triathlon event with the most splits if the athlete appears twice).
 */
export async function findAthleteResults(
	raceId: number,
	firstName: string,
	lastName: string,
): Promise<ExtractedRace> {
	const race = await getRace(raceId);
	const byYear = new Map<number, ExtractedResult>();

	for (const event of race.events) {
		const sets = await getResultSets(raceId, event.event_id);
		for (const set of sets) {
			const { rows, headers } = await getAllResults(raceId, event.event_id, set.id);
			const match = rows.find((r) => nameMatches(r, firstName, lastName));
			if (!match) continue;
			const result = extractResult(match, headers, rows, event, raceId, set.id);
			const existing = byYear.get(result.year);
			// keep the richer record if the athlete shows up in multiple sets for a year
			if (!existing || result.splits.length > existing.splits.length) {
				byYear.set(result.year, result);
			}
		}
	}

	const results = [...byYear.values()].sort((a, b) => a.year - b.year);
	return {
		platform: 'runsignup',
		race_id: raceId,
		name: cleanRaceName(race.name),
		sport: guessSport(race.name + ' ' + (results[0]?.event_name ?? '')),
		location: [race.city, race.state].filter(Boolean).join(', ') || null,
		url: `https://runsignup.com/Race/Results/${raceId}`,
		results,
	};
}

/** Strip "17th Annual " style prefixes that change year to year. */
function cleanRaceName(name: string): string {
	return name.replace(/^\d+(st|nd|rd|th)\s+annual\s+/i, '').trim();
}

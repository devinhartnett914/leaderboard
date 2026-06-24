// Single source of truth for race categories. A result maps to a category (sport,
// with triathlon split into Sprint / Olympic / Kids / generic), and each category
// has one color + icon + label. Every page reads from here so the look never drifts.
import { SPORT_LABELS } from './types';

export interface Category {
	key: string;
	label: string;
}

// One color per category — used for the row edge/tint, the category icon, AND the
// filter chips, so they always match. Triathlons = orange (bike accent), swims =
// light blue, road = peach-orange, trail = green.
export const CAT_COLOR: Record<string, string> = {
	sprint: '#ff7a5c', olympic: '#ff7a5c', triathlon: '#ff7a5c', kids_tri: '#ff7a5c',
	trail_run: '#29e3a4', road_run: '#ffb86b', swim_meet: '#00d4ff', open_water: '#3dd7ff', gravel: '#ffb86b', other: '#8fa5c4',
};
export const CAT_ICON: Record<string, string> = {
	sprint: '⚡', olympic: '🔥', triathlon: '🚴', kids_tri: '🧒', trail_run: '⛰️', road_run: '🏃', swim_meet: '🏊', open_water: '🌊', gravel: '🚵', other: '🏁',
};

export const catColor = (key: string): string => CAT_COLOR[key] ?? 'var(--muted)';
export const catIcon = (key: string): string => CAT_ICON[key] ?? '🏁';

// Minimal result shape that both ResultWithEdition and FeedResult satisfy.
interface CatInput {
	race_edition?: {
		distance_or_format?: string | null;
		race?: { sport?: string | null; name?: string | null } | null;
	} | null;
}

/**
 * The category for a result: sport, with triathlon split into Sprint / Olympic /
 * Kids (youth races detected from the race name) / generic Triathlon. The split
 * keys (sprint/olympic/kids_tri) are what the UI labels + filters by.
 */
export function categoryOf(r: CatInput): Category {
	const sport = (r.race_edition?.race?.sport ?? 'other') as keyof typeof SPORT_LABELS;
	if (sport === 'triathlon') {
		const name = (r.race_edition?.race?.name ?? '').toLowerCase();
		if (/\b(youth|kids?|junior)\b/.test(name)) return { key: 'kids_tri', label: 'Kids Tri' };
		const f = (r.race_edition?.distance_or_format ?? '').toLowerCase();
		if (f.includes('sprint')) return { key: 'sprint', label: 'Sprint Tri' };
		if (f.includes('olympic')) return { key: 'olympic', label: 'Olympic Tri' };
		return { key: 'triathlon', label: 'Triathlon' };
	}
	return { key: String(sport), label: SPORT_LABELS[sport] ?? String(sport) };
}

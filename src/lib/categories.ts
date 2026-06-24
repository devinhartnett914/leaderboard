// Single source of truth for race categories. A result maps to a category (sport,
// with triathlon split into Sprint / Olympic / Kids / generic), and each category
// has one color + icon + label. Every page reads from here so the look never drifts.
import { SPORT_LABELS } from './types';

export interface Category {
	key: string;
	label: string;
}

// One color per category — used for the row edge/tint, the category color, AND the
// filter chips, so they always match. Triathlons = purple, swims = light blue, road =
// peach-orange, trail = green. NOTE: the category ICON is a native color emoji and is
// NOT tinted by this color (see CardMeta `.cm-ic`) — e.g. Sprint Tri stays purple but its
// ⚡ renders as the orange emoji bolt.
export const CAT_COLOR: Record<string, string> = {
	sprint: '#a78bfa', olympic: '#a78bfa', triathlon: '#a78bfa', kids_tri: '#a78bfa',
	trail_run: '#29e3a4', road_run: '#ffb86b', swim_meet: '#00d4ff', open_water: '#3dd7ff', gravel: '#ffb86b', other: '#8fa5c4',
};
// U+FE0F (emoji variation selector) on ⚡ forces color-emoji presentation, so the bolt
// renders as the native orange glyph instead of a mono text glyph tinted by the category.
export const CAT_ICON: Record<string, string> = {
	sprint: '⚡️', olympic: '🔥', triathlon: '🚴', kids_tri: '🧒', trail_run: '⛰️', road_run: '🏃', swim_meet: '🏊', open_water: '🌊', gravel: '🚵', other: '🏁',
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

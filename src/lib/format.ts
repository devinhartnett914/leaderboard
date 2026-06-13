// Time + display formatting helpers. Times are stored as integer seconds.

/** Parse "1:34:24" -> 5664, "8:26" -> 506, "45" -> 45. Returns null for blank/garbage. */
export function parseDuration(text: string | number | null | undefined): number | null {
	if (text == null) return null;
	if (typeof text === 'number') return Number.isFinite(text) ? Math.round(text) : null;
	const t = text.trim();
	if (!t) return null;
	const parts = t.split(':').map((p) => Number(p));
	if (parts.length === 0 || parts.some((n) => Number.isNaN(n))) return null;
	return Math.round(parts.reduce((acc, n) => acc * 60 + n, 0));
}

/** 8070 -> "2:14:30"; 545 -> "9:05". Returns "—" for null/undefined. */
export function formatTime(seconds: number | null | undefined): string {
	if (seconds == null) return '—';
	const sign = seconds < 0 ? '-' : '';
	const s = Math.abs(Math.round(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	return h > 0 ? `${sign}${h}:${pad(m)}:${pad(sec)}` : `${sign}${m}:${pad(sec)}`;
}

/**
 * Signed delta vs a baseline, e.g. -0:30 (faster) or +1:15 (slower).
 * Returns null when either value is missing.
 */
export function formatDelta(
	seconds: number | null | undefined,
	baseline: number | null | undefined,
): string | null {
	if (seconds == null || baseline == null) return null;
	const diff = seconds - baseline;
	if (diff === 0) return '±0:00';
	const sign = diff < 0 ? '−' : '+';
	return `${sign}${formatTime(Math.abs(diff))}`;
}

/** 'faster' if quicker than baseline, 'slower' if not, 'same' if equal/unknown. */
export function deltaDirection(
	seconds: number | null | undefined,
	baseline: number | null | undefined,
): 'faster' | 'slower' | 'same' {
	if (seconds == null || baseline == null || seconds === baseline) return 'same';
	return seconds < baseline ? 'faster' : 'slower';
}

/** Ordinal: 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 24 -> "24th". */
export function ordinal(n: number | null | undefined): string {
	if (n == null) return '—';
	const rem100 = n % 100;
	if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
	switch (n % 10) {
		case 1: return `${n}st`;
		case 2: return `${n}nd`;
		case 3: return `${n}rd`;
		default: return `${n}th`;
	}
}

/** "1st of 28" style placement, omitting the field size if unknown. */
export function placement(place: number | null | undefined, of: number | null | undefined): string {
	if (place == null) return '—';
	return of != null ? `${ordinal(place)} of ${of}` : ordinal(place);
}

/** A podium finish is a top-3 placement. */
export function isPodium(place: number | null | undefined): boolean {
	return place != null && place <= 3;
}

// ---- Swimming --------------------------------------------------------------
// Swim times live in hundredths (result.finish_time_cs); a PR can be 1/100th.
// Convention: under a minute shows as "SS.cc" (33.93), over as "M:SS.cc" (1:03.60).

/**
 * Format a swim time from hundredths of a second. Falls back to whole seconds
 * (finish_time_seconds) when cs is missing, so older/rounded rows still render.
 * 3393 -> "33.93"; 6360 -> "1:03.60"; 17543 -> "2:55.43".
 */
export function formatSwimTime(cs: number | null | undefined, secondsFallback?: number | null): string {
	let hundredths = cs;
	if (hundredths == null) {
		if (secondsFallback == null) return '—';
		hundredths = Math.round(secondsFallback * 100);
	}
	const sign = hundredths < 0 ? '−' : '';
	const h = Math.abs(Math.round(hundredths));
	const totalSec = Math.floor(h / 100);
	const frac = h % 100;
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	return m > 0 ? `${sign}${m}:${pad(s)}.${pad(frac)}` : `${sign}${s}.${pad(frac)}`;
}

/** Signed swim delta in seconds vs a baseline (hundredths in): -1.60 faster, +0.45 slower. */
export function formatSwimDelta(cs: number | null | undefined, baselineCs: number | null | undefined): string | null {
	if (cs == null || baselineCs == null) return null;
	const diff = (cs - baselineCs) / 100;
	if (diff === 0) return '±0.00';
	return `${diff < 0 ? '−' : '+'}${Math.abs(diff).toFixed(2)}`;
}

export interface SwimEvent {
	distance: number | null; // meters (or yards), as printed in the event label
	stroke: string; // full stroke, e.g. "Freestyle"
	strokeKey: 'free' | 'back' | 'breast' | 'fly' | 'im' | 'other';
	isRelay: boolean;
	short: string; // compact label for chips/rows, e.g. "50 Free", "100 Free Relay"
	icon: string;
	color: string;
}

const STROKE_META: Record<SwimEvent['strokeKey'], { short: string; icon: string; color: string }> = {
	free: { short: 'Free', icon: '🏊', color: 'var(--swim)' },
	back: { short: 'Back', icon: '🔙', color: '#5bd1ff' },
	breast: { short: 'Breast', icon: '🐸', color: '#3ddc97' },
	fly: { short: 'Fly', icon: '🦋', color: '#b98bff' },
	im: { short: 'IM', icon: '🌀', color: '#ffb86b' },
	other: { short: '', icon: '🏊', color: 'var(--swim)' },
};

/**
 * Parse a canonical swim event string ("50m Freestyle", "100m Freestyle Relay")
 * into its parts for display + grouping. Distance/stroke/relay determine an
 * event's identity for progression (age group is intentionally excluded).
 */
export function parseSwimEvent(event: string | null | undefined): SwimEvent {
	const raw = (event ?? '').trim();
	const m = raw.match(/^(\d+)\s*(?:m|y)?\s+(.+)$/i);
	const distance = m ? Number(m[1]) : null;
	const rest = (m ? m[2] : raw).trim();
	const isRelay = /relay/i.test(rest);
	const strokeName = rest.replace(/\s*relay\s*$/i, '').trim();
	const l = strokeName.toLowerCase();
	const strokeKey: SwimEvent['strokeKey'] =
		/free/.test(l) ? 'free' :
		/back/.test(l) ? 'back' :
		/breast/.test(l) ? 'breast' :
		/fly|butter/.test(l) ? 'fly' :
		/medley|\bim\b|individual/.test(l) ? 'im' : 'other';
	const meta = STROKE_META[strokeKey];
	const shortStroke = meta.short || strokeName;
	const short = [distance != null ? String(distance) : null, shortStroke, isRelay ? 'Relay' : null]
		.filter(Boolean)
		.join(' ');
	return { distance, stroke: strokeName, strokeKey, isRelay, short, icon: meta.icon, color: meta.color };
}

/** Strip the trailing heat token off a division → the age group: "9-10 C" → "9-10". */
export function ageGroupOf(div: string | null | undefined): string | null {
	return (div ?? '').replace(/\s+(A|B|C|D|Non-?Award)\b.*$/i, '').trim() || null;
}

/** Abbreviate a division/age-group for tight callouts: "8 & Under" → "8&U". */
export function abbrevDivision(s: string | null | undefined): string | null {
	if (!s) return null;
	return s
		.replace(/(\d+)\s*&\s*under/gi, '$1&U')
		.replace(/(\d+)\s*&\s*over/gi, '$1&O')
		.replace(/\s+/g, ' ')
		.trim() || null;
}

/** Swim division for tight callouts: full age-group + heat joined by a dot
 *  ("8 & Under C" → "8&U•C") — keeps the heat the marks need while tightening
 *  the awkward space between the two. */
export function swimDivision(s: string | null | undefined): string | null {
	const a = abbrevDivision(s);
	if (!a) return null;
	return a.replace(/\s+(A|B|C|D|Non-?Award)\b/i, '•$1');
}

/** Stable identity for a swim event across meets/ages: course + distance + stroke. */
export function swimEventKey(event: string | null | undefined, course: string | null | undefined): string {
	const e = parseSwimEvent(event);
	const c = (course ?? '').trim().toUpperCase();
	return `${c}|${e.distance ?? '?'}|${e.strokeKey}|${e.isRelay ? 'R' : 'I'}`;
}

const STROKE_SLUG: Record<SwimEvent['strokeKey'], string> = {
	free: 'freestyle', back: 'backstroke', breast: 'breaststroke', fly: 'butterfly', im: 'im', other: '',
};

/**
 * URL slug for an event series, e.g. "50m Backstroke" → "50m-backstroke",
 * "100m Freestyle Relay" → "100m-freestyle-relay". Identity is distance + stroke
 * (course-agnostic — fine while the league is single-course; revisit if yards appear).
 */
export function swimEventSlug(event: string | null | undefined): string {
	const e = parseSwimEvent(event);
	const stroke = STROKE_SLUG[e.strokeKey] || e.stroke.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
	const dist = e.distance != null ? `${e.distance}m` : 'event';
	return `${dist}-${stroke}${e.isRelay ? '-relay' : ''}`.replace(/-+/g, '-').replace(/(^-|-$)/g, '');
}

// ---- Distance + pace -------------------------------------------------------
// distance_m is always meters (canonical). distance_unit is how to display it.

const YARD_M = 0.9144;
const MILE_M = 1609.344;

/** Format a leg distance in its display unit: "750 m", "400 yd", "12.0 mi", "5.0 km". */
export function formatDistance(meters: number | null | undefined, unit: string | null | undefined): string | null {
	if (meters == null || !unit) return null;
	switch (unit) {
		case 'yd': return `${Math.round(meters / YARD_M)} yd`;
		case 'm': return `${Math.round(meters)} m`;
		case 'mi': return `${(meters / MILE_M).toFixed(1)} mi`;
		case 'km': return `${(meters / 1000).toFixed(1)} km`;
		default: return null;
	}
}

/** Human pace for a leg, by unit: swim "1:06 /100m", bike "17.3 mph", run "7:21 /km". */
export function legPace(
	meters: number | null | undefined,
	seconds: number | null | undefined,
	unit: string | null | undefined,
): string | null {
	if (!meters || !seconds || !unit) return null;
	switch (unit) {
		case 'm': return `${formatTime(seconds / (meters / 100))} /100m`;
		case 'yd': return `${formatTime(seconds / (meters / YARD_M / 100))} /100yd`;
		case 'mi': return `${(meters / MILE_M / (seconds / 3600)).toFixed(1)} mph`;
		case 'km': return `${formatTime(seconds / (meters / 1000))} /km`;
		default: return null;
	}
}

/**
 * Normalized pace in seconds per 100m — a single "lower is faster" number for
 * comparing a leg across years even when the distance changed. Null if no distance.
 */
export function pacePer100m(meters: number | null | undefined, seconds: number | null | undefined): number | null {
	if (!meters || !seconds || meters <= 0) return null;
	return seconds / (meters / 100);
}

// ---- Race-leg presentation + age ------------------------------------------

/** Emoji for a triathlon (or other) leg, by label. */
export function legIcon(label: string): string {
	const l = label.toLowerCase();
	if (l.includes('swim')) return '🏊';
	if (l.includes('bike') || l.includes('cycle')) return '🚴';
	if (l.includes('run') || /\bmile|\d+k\b|\bkm\b/.test(l)) return '🏃';
	if (/^t\d/i.test(label)) return '🔁';
	return '•';
}

/** CSS color variable for a leg (swim/bike/run), for icon tinting. */
export function legColor(label: string): string {
	const l = label.toLowerCase();
	if (l.includes('swim')) return 'var(--swim)';
	if (l.includes('bike') || l.includes('cycle')) return 'var(--bike)';
	if (l.includes('run') || /\bmile|\d+k\b|\bkm\b/.test(l)) return 'var(--run)';
	return 'var(--muted)';
}

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Split an ISO date into a stacked date-rail's parts: { mon, day, year }. */
export function dateParts(iso: string | null | undefined, fallbackYear?: number | null) {
	const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (m) return { mon: MON[Number(m[2]) - 1], day: String(Number(m[3])), year: m[1] };
	return { mon: '', day: '', year: fallbackYear ? String(fallbackYear) : '' };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2024-06-02" -> "June 2, 2024". */
export function formatFullDate(iso: string | null | undefined): string | null {
	const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
	return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : null;
}

/** Current age from a yyyy-mm-dd birth date, falling back to birth year. */
export function currentAge(birthDate: string | null | undefined, birthYear: number | null | undefined): number | null {
	const today = new Date();
	if (birthDate) {
		const b = new Date(`${birthDate}T00:00:00`);
		let age = today.getFullYear() - b.getFullYear();
		const m = today.getMonth() - b.getMonth();
		if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
		return age;
	}
	if (birthYear) return today.getFullYear() - birthYear;
	return null;
}

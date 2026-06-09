// Time + display formatting helpers. Times are stored as integer seconds.

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

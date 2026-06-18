// Single source of truth for podium medals (gold / silver / bronze). Used by
// PodiumMedal (the mark left of a time) and the people-page podium filter chips, so
// the glyph, short name, and color never drift between them. Tier is 1 | 2 | 3.
export const MEDAL_EMOJI = ['🥇', '🥈', '🥉'] as const;
export const MEDAL_NAME = ['1st', '2nd', '3rd'] as const;
export const MEDAL_COLOR = ['#f0b400', '#b4bfca', '#cf7d44'] as const;

const tierIndex = (tier: number): number => Math.min(Math.max(Math.round(tier), 1), 3) - 1;

/** Medal glyph for a podium tier (1|2|3), clamped to range. */
export const medalEmoji = (tier: number): string => MEDAL_EMOJI[tierIndex(tier)];
/** Short ordinal name ("1st"/"2nd"/"3rd") for a podium tier. */
export const medalName = (tier: number): string => MEDAL_NAME[tierIndex(tier)];
/** Medal color for a podium tier — for chip tints / accents. */
export const medalColor = (tier: number): string => MEDAL_COLOR[tierIndex(tier)];

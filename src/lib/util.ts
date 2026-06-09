/** "Reston Sprint Triathlon" -> "reston-sprint-triathlon" */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{Diacritic}/gu, '') // strip accents
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

/** Lowercased, whitespace-collapsed name for cross-year matching. */
export function normalizeName(fullName: string): string {
	return fullName.trim().toLowerCase().replace(/\s+/g, ' ');
}

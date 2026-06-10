// Parse a HY-TEK Meet Manager results listing — the format every Reston Swim
// League / Glade Dolphins meet PDF uses — into a structured meet.
//
// Deterministic string processing: no external deps, free to run, and (unlike an
// LLM call) it gives the exact same answer every time. The format is fixed by the
// timing software, so a parser is more reliable here than extraction-by-prompt.
//
// Hard rule encoded below: a swimmer's competition AGE GROUP comes from the event
// header ("Girls 9-10"), never from the age printed next to their name — the
// printed age can be wrong (it was for Sierra at the 6/6/2026 meet).

export type SwimStatus = 'finished' | 'dq' | 'dns';

export interface SwimmerName {
	first: string;
	last: string;
	/** lowercased "first last" — the key used for roster matching */
	norm: string;
	/** original "Last, First MI" exactly as printed */
	raw: string;
}

export interface IndivEntry {
	kind: 'indiv';
	place: string; // "1", "*3" (tie), or "---" (no place, e.g. DQ)
	name: SwimmerName;
	printedAge: number; // as printed — never used to decide age group
	team: string; // "GL-VA"
	division: string | null; // heat: "A" | "B" | "C" | "Non-Award"
	timeSeconds: number | null; // null for DQ/NS/scratch
	status: SwimStatus;
	points: number;
}

export interface RelayLeg {
	name: SwimmerName;
	age: number;
}

export interface RelayEntry {
	kind: 'relay';
	place: string;
	team: string; // "GL-VA"
	relay: string; // "A" | "B" | "C"
	timeSeconds: number | null;
	status: SwimStatus;
	points: number;
	legs: RelayLeg[];
}

export type Entry = IndivEntry | RelayEntry;

export interface MeetEvent {
	number: number;
	gender: 'Boys' | 'Girls' | 'Women' | 'Men' | 'Mixed';
	ageGroup: string; // authoritative competition group: "8 & Under", "9-10", ...
	distance: number; // meters (or yards if SCY)
	stroke: string; // "Freestyle", "Butterfly", "Freestyle Relay", ...
	course: string; // "SCM" | "SCY" | "LCM"
	isRelay: boolean;
	entries: Entry[];
}

export interface TeamScore {
	name: string;
	points: number;
}

export interface ParsedMeet {
	league: string | null; // "Reston Swim League"
	meetCode: string | null; // "AW@GL" (away @ home team codes)
	date: string | null; // ISO "2026-06-06"
	course: string; // "SCM"
	events: MeetEvent[];
	teamScores: TeamScore[]; // combined (overall) scores
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** "1:03.60" -> 63.6 ; "57.40" -> 57.4 ; "DQ"/"NS"/"" -> null */
export function timeToSeconds(t: string): number | null {
	if (!t || /^(DQ|NS|SCR|DFS|DNF)$/i.test(t)) return null;
	if (!/^\d/.test(t)) return null;
	return t.split(':').reduce((acc, p) => acc * 60 + parseFloat(p), 0);
}

function statusFor(timeToken: string): SwimStatus {
	if (/^(DQ|DFS)$/i.test(timeToken)) return 'dq';
	if (/^(NS|SCR|DNF)$/i.test(timeToken)) return 'dns';
	return 'finished';
}

/** "Hartnett, Sierra K" -> { first:"Sierra", last:"Hartnett", norm:"sierra hartnett" } */
export function parseName(lastFirst: string): SwimmerName {
	const [last, rest = ''] = lastFirst.split(',').map((s) => s.trim());
	const first = rest.split(/\s+/)[0] || '';
	const norm = `${first} ${last}`.toLowerCase().replace(/\s+/g, ' ').trim();
	return { first, last, norm, raw: lastFirst.trim() };
}

const COURSE: Record<string, string> = { 'SC Meter': 'SCM', 'SC Yard': 'SCY', 'LC Meter': 'LCM' };

const EVENT_RE =
	/^Event (\d+) (Boys|Girls|Women|Men|Mixed) (.+) (\d+) (SC Meter|SC Yard|LC Meter) (.+)$/;
const DIVISION_RE = /^(A|B|C|Non-Award)\b.*Division/; // also matches page-break continuations
const INDIV_RE =
	/^(\*?\d+|---)\s+(.+?)\s+(\d{1,2})\s+([A-Z]{2,}-[A-Z]{2})\s+(DQ|NS|SCR|DFS|DNF|(?:\d+:)?\d{1,2}\.\d{2})(?:\s+(\d+(?:\.\d+)?))?$/;
const RELAY_TEAM_RE =
	/^(\*?\d+|---)\s+([A-Z]{2,}-[A-Z]{2})\s+([A-Z])\s+(DQ|NS|SCR|DFS|DNF|(?:\d+:)?\d+\.\d{2})(?:\s+(\d+(?:\.\d+)?))?$/;
const LEG_RE = /(\d)\)\s+(.+?)\s+(\d{1,2})(?=\s+\d\)|\s*$)/g;
const SCORE_RE = /^\d+\.\s+(.+?)\s+(\d+)$/;

// Lines that are page furniture, column headers, or section labels — never data.
const SKIP_RE =
	/^(Reston Swim League|HY-TEK|RSTA |Results - MeetDay|Name\s+Age\s+Team|Team\s+Relay\s+Finals|Page \d+)/;

function toISODate(mdy: string): string | null {
	const m = mdy.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (!m) return null;
	const [, mo, d, y] = m;
	return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// parser
// ---------------------------------------------------------------------------

export function parseHytekMeet(text: string): ParsedMeet {
	const meet: ParsedMeet = {
		league: null,
		meetCode: null,
		date: null,
		course: 'SCM',
		events: [],
		teamScores: [],
	};

	let ev: MeetEvent | null = null;
	let division: string | null = null;
	let scores: 'none' | 'combined' | 'done' = 'none';

	for (const raw of text.split('\n')) {
		const line = raw.trim();
		if (!line) continue;

		// --- meet identity (from the repeated page header) ---
		if (meet.league == null && line.startsWith('Reston Swim League')) {
			meet.league = 'Reston Swim League';
		}
		if (meet.meetCode == null) {
			const h = line.match(/^RSTA\s+(.+?)\s+-\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
			if (h) {
				meet.meetCode = h[1];
				meet.date = toISODate(h[2]);
			}
		}

		// --- team scores section (comes after all events) ---
		if (/^Combined Team Scores/.test(line)) {
			scores = 'combined';
			continue;
		}
		if (/^Scores - (Women|Men)/.test(line) || /Team Rankings/.test(line)) {
			scores = 'done'; // only keep the combined totals
			continue;
		}
		if (scores === 'combined') {
			const sm = line.match(SCORE_RE);
			if (sm) meet.teamScores.push({ name: sm[1], points: +sm[2] });
			continue;
		}
		if (scores === 'done') continue;

		// --- event header ---
		const em = line.match(EVENT_RE);
		if (em) {
			const stroke = em[6].trim();
			meet.course = COURSE[em[5]] ?? 'SCM';
			ev = {
				number: +em[1],
				gender: em[2] as MeetEvent['gender'],
				ageGroup: em[3].trim(),
				distance: +em[4],
				stroke,
				course: meet.course,
				isRelay: /relay/i.test(stroke),
				entries: [],
			};
			meet.events.push(ev);
			division = null;
			continue;
		}

		if (!ev || SKIP_RE.test(line)) continue;

		// --- division header (incl. "C - Division ... (Event 7 ...)" continuations) ---
		const dm = line.match(DIVISION_RE);
		if (dm) {
			division = dm[1];
			continue;
		}

		// --- relay event: team rows + leg rows ---
		if (ev.isRelay) {
			const rm = line.match(RELAY_TEAM_RE);
			if (rm) {
				ev.entries.push({
					kind: 'relay',
					place: rm[1],
					team: rm[2],
					relay: rm[3],
					timeSeconds: timeToSeconds(rm[4]),
					status: statusFor(rm[4]),
					points: rm[5] ? parseFloat(rm[5]) : 0,
					legs: [],
				});
				continue;
			}
			const last = ev.entries[ev.entries.length - 1];
			if (last && last.kind === 'relay' && /^\d\)/.test(line)) {
				for (const m of line.matchAll(LEG_RE)) {
					last.legs.push({ name: parseName(m[2]), age: +m[3] });
				}
			}
			continue;
		}

		// --- individual event ---
		const im = line.match(INDIV_RE);
		if (im) {
			ev.entries.push({
				kind: 'indiv',
				place: im[1],
				name: parseName(im[2]),
				printedAge: +im[3],
				team: im[4],
				division,
				timeSeconds: timeToSeconds(im[5]),
				status: statusFor(im[5]),
				points: im[6] ? parseFloat(im[6]) : 0,
			});
		}
	}

	return meet;
}

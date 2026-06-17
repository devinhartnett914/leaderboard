// Match a family roster against a parsed meet and pull out each member's swims.
//
// Matching is by NAME (first + last), never by age. The timing system's printed
// age can be wrong, and there can be a same-first-name swimmer on another team
// (the 6/6/2026 meet had both "Aurora Hartnett" and "Aurora Quarrie") — so the
// full normalized "first last" is the key.

import type { ParsedMeet } from './hytek';

export interface RosterPerson {
	id?: string;
	full_name: string;
}

export interface MatchedIndivResult {
	eventNumber: number;
	event: string; // comparable PR label, e.g. "50m Freestyle" (age-group-independent)
	ageGroup: string; // competition group from the event header, e.g. "9-10"
	course: string; // "SCM"
	heat: string | null; // seeding division: "A" | "B" | "C" | "Non-Award"
	place: number | null;
	timeSeconds: number | null;
	status: 'finished' | 'dq' | 'dns';
	points: number;
	printedAge: number; // kept for reference only
}

export interface MatchedRelayResult {
	eventNumber: number;
	event: string; // "100m Freestyle Relay"
	ageGroup: string;
	course: string;
	team: string; // "GL-VA C"
	place: number | null;
	timeSeconds: number | null;
	status: 'finished' | 'dq' | 'dns';
}

export interface SwimmerMeetResults {
	person: RosterPerson;
	individual: MatchedIndivResult[];
	relays: MatchedRelayResult[];
}

function normName(full: string): string {
	return full.toLowerCase().replace(/\s+/g, ' ').trim();
}

function placeNum(p: string): number | null {
	if (p === '---') return null;
	const n = parseInt(p.replace('*', ''), 10);
	return Number.isNaN(n) ? null : n;
}

export function matchRoster(meet: ParsedMeet, roster: RosterPerson[]): SwimmerMeetResults[] {
	const byNorm = new Map<string, SwimmerMeetResults>();
	for (const person of roster) {
		byNorm.set(normName(person.full_name), { person, individual: [], relays: [] });
	}

	for (const ev of meet.events) {
		const label = `${ev.distance}m ${ev.stroke}`;
		for (const e of ev.entries) {
			if (e.kind === 'indiv') {
				const hit = byNorm.get(e.name.norm);
				if (!hit) continue;
				hit.individual.push({
					eventNumber: ev.number,
					event: label,
					ageGroup: ev.ageGroup,
					course: ev.course,
					heat: e.division,
					place: placeNum(e.place),
					timeSeconds: e.timeSeconds,
					status: e.status,
					points: e.points,
					printedAge: e.printedAge,
				});
			} else {
				for (const leg of e.legs) {
					const hit = byNorm.get(leg.name.norm);
					if (!hit) continue;
					hit.relays.push({
						eventNumber: ev.number,
						event: label,
						ageGroup: ev.ageGroup,
						course: ev.course,
						team: `${e.team} ${e.relay}`,
						place: placeNum(e.place),
						timeSeconds: e.timeSeconds,
						status: e.status,
					});
				}
			}
		}
	}

	return [...byNorm.values()];
}

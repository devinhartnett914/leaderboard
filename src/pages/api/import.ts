import type { APIRoute } from 'astro';
import { parseRunsignupUrl, findAthleteResults } from '../../lib/platforms/runsignup';
import { ingestExtractedRace, type AthleteInput } from '../../lib/ingest';

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// NOTE: not yet auth-gated — local use only. Auth gate is added before deploy.
export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const { url, firstName, lastName, athlete, raceNameOverride, dryRun } = body as {
			url?: string;
			firstName?: string;
			lastName?: string;
			athlete?: AthleteInput;
			raceNameOverride?: string;
			dryRun?: boolean;
		};

		if (!url || !firstName || !lastName) {
			return json({ error: 'url, firstName, and lastName are required' }, 400);
		}

		const parsed = parseRunsignupUrl(url);
		if (!parsed) {
			return json({ error: 'Not a recognized RunSignup / TriSignup results URL' }, 400);
		}

		const extracted = await findAthleteResults(parsed.raceId, firstName, lastName);
		if (extracted.results.length === 0) {
			return json({ error: `No results found for "${firstName} ${lastName}" in race ${parsed.raceId}` }, 404);
		}

		if (dryRun) {
			return json({ dryRun: true, extracted });
		}

		const summary = await ingestExtractedRace(
			extracted,
			athlete ?? { full_name: `${firstName} ${lastName}`, is_family: true },
			{ raceNameOverride },
		);
		return json({ ok: true, summary });
	} catch (err) {
		return json({ error: err instanceof Error ? err.message : String(err) }, 500);
	}
};

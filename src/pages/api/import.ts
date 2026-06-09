import type { APIRoute } from 'astro';
import { parseRunsignupUrl, findAthleteResults } from '../../lib/platforms/runsignup';
import { ingestExtractedRace, type AthleteInput } from '../../lib/ingest';

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Admin-only write endpoint. Requires the x-admin-token header to match ADMIN_TOKEN.
// Safe by default: if ADMIN_TOKEN is unset, every request is rejected.
const adminToken = (import.meta.env.ADMIN_TOKEN ??
	(typeof process !== 'undefined' ? process.env.ADMIN_TOKEN : undefined)) as string | undefined;

export const POST: APIRoute = async ({ request }) => {
	if (!adminToken || request.headers.get('x-admin-token') !== adminToken) {
		return json({ error: 'unauthorized' }, 401);
	}
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

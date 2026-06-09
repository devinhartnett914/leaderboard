import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

/** True once the Supabase project URL + anon key are set in the environment. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Anonymous client for public reads. Respects Row-Level Security (public read,
 * authenticated write). Null until the project is configured, so pages can show
 * a friendly "set up Supabase" message instead of crashing.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
	? createClient(url!, anonKey!, { auth: { persistSession: false } })
	: null;

/**
 * Service-role client for server-only writes (the scrape/save endpoints).
 * Bypasses RLS — NEVER import this into client-side code.
 */
export function getServiceClient(): SupabaseClient {
	if (!url || !serviceKey) {
		throw new Error(
			'Supabase service role not configured — set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
		);
	}
	return createClient(url, serviceKey, { auth: { persistSession: false } });
}

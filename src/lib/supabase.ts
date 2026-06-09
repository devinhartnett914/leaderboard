import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Read from import.meta.env (Astro) with a process.env fallback so server-only
// secrets resolve in dev and on Netlify regardless of how the var is injected.
const env = import.meta.env as Record<string, string | undefined>;
const proc: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {};
const url = env.PUBLIC_SUPABASE_URL ?? proc.PUBLIC_SUPABASE_URL;
const anonKey = env.PUBLIC_SUPABASE_ANON_KEY ?? proc.PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? proc.SUPABASE_SERVICE_ROLE_KEY;

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

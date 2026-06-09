// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
	// Server-rendered by default (auth, API routes, DB-driven pages).
	// Individual pages can opt back into static with `export const prerender = true`.
	output: 'server',
	adapter: netlify(),
	// Bind the dev server to all interfaces so it's reachable from the laptop
	// over Tailscale (http://100.71.23.28:<port>/), not just localhost on the Mac mini.
	server: { host: true },
});

import { createClient } from '@supabase/supabase-js';

// Public identifiers for the vamp Supabase project. These are safe to ship
// in frontend code: the publishable key is designed to be public and all
// data access is enforced by row-level security on the server.
// Vercel env vars, when present, override these defaults.
const DEFAULT_URL = 'https://vbcnnhptclckgaczvcxf.supabase.co';
const DEFAULT_KEY = 'sb_publishable_xDQf0hwHdj8QT1gf_gfddA_Usbb6hLd';

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_KEY;

export const CONFIG_OK = Boolean(url && key);

// never crash on missing config; main.jsx shows a setup screen instead
export const supabase = CONFIG_OK ? createClient(url, key) : null;

// Cloudflare's public TEST site key (always passes) until real Turnstile
// keys are configured — replace via env var before launch.
export const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

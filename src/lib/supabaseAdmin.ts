import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

/**
 * Server-side Supabase client. There's no account system in this app (no
 * login), so there's no per-user session to scope row access to — the
 * publishable key plus permissive RLS policies (see
 * supabase/migrations/0001_init.sql) is the right fit, not a service-role
 * key. Only ever called from API routes, never from client components.
 * Returns null when Supabase hasn't been provisioned yet, in which case
 * callers fall back to the in-memory store.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return cached;
}

// lib/supabaseBrowser.ts
// Browser-side Supabase client used for authentication (persisted session).
// IMPORTANT: do NOT throw at import/build time if env vars are missing.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

export function hasSupabaseBrowserEnv(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

// Returns a cached browser client, or null if env vars are not configured.
// This is important so CI builds (or static prerenders) don't crash.
export function getSupabaseBrowser(): SupabaseClient | null {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return null

  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return _client
}

// Allow logging in with a simple username (e.g. 'admin') while still using Supabase email/password auth.
// If the input already looks like an email, keep it.
// Example: 'eduard.tudose' -> 'eduard.tudose@adr.local'
export function normalizeLoginToEmail(usernameOrEmail: string): string {
  const raw = (usernameOrEmail || "").trim()
  if (!raw) return ""
  if (raw.includes("@")) return raw
  return `${raw}@adr.local`
}

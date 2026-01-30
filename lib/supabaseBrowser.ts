// lib/supabaseBrowser.ts
// Browser-side Supabase client used for authentication (persisted session).

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.",
    )
  }

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
export function normalizeLoginToEmail(usernameOrEmail: string): string {
  const raw = (usernameOrEmail || "").trim()
  if (!raw) return ""
  if (raw.includes("@")) return raw
  return `${raw}@adr.local`
}

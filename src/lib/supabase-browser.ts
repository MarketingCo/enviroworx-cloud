import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function assertKeys() {
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  }
}

/** Browser — OAuth and client-side auth (safe to import from Client Components) */
export function createSupabaseBrowserClient() {
  assertKeys()
  return createBrowserClient<Database>(url!, anonKey!)
}

/**
 * Singleton browser client that reads the Supabase Auth session from cookies.
 * Office staff sign in via Google OAuth which sets a Supabase session cookie.
 * This client picks that up, giving `authenticated` role so RLS policies work.
 * Import this in office client components instead of `supabase` from `lib/supabase`.
 */
export const supabase = createBrowserClient<Database>(
  url || 'https://missing-url.supabase.co',
  anonKey || 'missing-key',
  { realtime: { params: { eventsPerSecond: 10 } } }
)

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

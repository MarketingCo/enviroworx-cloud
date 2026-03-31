/**
 * Supabase Client Configuration
 *
 * Two clients:
 * 1. Browser client (uses anon key, respects RLS)
 * 2. Server client (uses service_role key, bypasses RLS)
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// These come from your Supabase project dashboard > Settings > API
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    'ERROR: Supabase environment variables are missing. ' +
    'Please copy .env.local.example to .env.local and fill in your keys. ' +
    'See DEPLOYMENT_QUICK_START.md for instructions.'
  )
}

// Browser client (for React components)
export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://missing-url.supabase.co', 
  SUPABASE_ANON_KEY || 'missing-key', 
  {
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  }
)

// Server client (for API routes, server components - bypasses RLS)
export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL || 'https://missing-url.supabase.co', 
  SUPABASE_SERVICE_KEY || 'missing-key', 
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
)

// Helper to get realtime channel for live updates
export function getRealtimeChannel(table: string) {
  return supabase
    .channel(`public:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      // This will be handled by the subscriber
      return payload
    })
}

/**
 * @deprecated Use createBrowserSupabase() from '@/lib/supabase-client' in Client Components
 * @deprecated Use createServerSupabase() from '@/lib/supabase-server' in Server Components
 *
 * This file is kept for backwards compatibility during migration.
 * supabaseAdmin is still valid for server-side operations that need
 * to bypass RLS (Row Level Security), such as background jobs,
 * cron tasks, and admin data operations.
 *
 * Migration plan:
 *   Client Components:  replace `import { supabase } from '@/lib/supabase'`
 *                       with `import { createBrowserSupabase } from '@/lib/supabase-client'`
 *   Server Components:  replace `import { supabase } from '@/lib/supabase'`
 *                       with `import { createServerSupabase } from '@/lib/supabase-server'`
 *   API Routes:         replace `import { supabaseAdmin } from '@/lib/supabase'`
 *                       with `import { createServerSupabase } from '@/lib/supabase-server'`
 *                       OR keep supabaseAdmin for RLS-bypass operations
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

/**
 * @deprecated Use createBrowserSupabase() from '@/lib/supabase-client' instead.
 * Browser client (for React components) - respects RLS policies.
 */
export const supabase = createClient<Database>(
  SUPABASE_URL || 'https://missing-url.supabase.co',
  SUPABASE_ANON_KEY || 'missing-key',
  {
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  }
)

/**
 * Server admin client - bypasses RLS using service_role key.
 * Still valid for: background jobs, cron tasks, admin data operations.
 *
 * For authenticated user operations in API routes/Server Components,
 * prefer createServerSupabase() from '@/lib/supabase-server' which
 * respects RLS and applies the user's auth context.
 */
export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL || 'https://missing-url.supabase.co',
  SUPABASE_SERVICE_KEY || 'missing-key',
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
)

/**
 * Safely log to activity_log table.
 * In non-production environments, throws on failure so broken audit logging is noticed.
 * In production, logs the error but does not break the user flow.
 */
export async function safeActivityLog(payload: {
  type: string
  message: string
  status: string
  userId?: string
  userRole?: string
  details?: Record<string, unknown>
}) {
  try {
    await supabaseAdmin.from('activity_log').insert({
      ...payload,
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    // In non-production, raise so we notice broken audit logging
    if (process.env.NODE_ENV !== 'production') {
      console.error('Activity log failed (non-prod — throwing):', e)
      throw e
    }
    // In production, log but don't break the user flow
    console.error('Activity log failed:', e)
  }
}

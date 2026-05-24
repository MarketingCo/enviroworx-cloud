import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Public health check for uptime monitors (no secrets in response).
 */
export async function GET() {
  const checks: Record<string, boolean> = {
    supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_anon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    session_secret: Boolean(process.env.SESSION_SECRET || process.env.CRON_SECRET),
    db: false,
  }

  try {
    const { error } = await supabaseAdmin.from('config').select('key').limit(1)
    checks.db = !error
  } catch {
    checks.db = false
  }

  const ok =
    checks.supabase_url &&
    checks.supabase_anon &&
    checks.service_role &&
    checks.db

  return NextResponse.json(
    {
      ok,
      service: 'enviroworx-cloud',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  )
}

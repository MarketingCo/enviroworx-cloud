import { NextResponse } from 'next/server'
import { getSessionSecret, getSupabaseServiceRoleKey, hasSupabasePublicConfig } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Public health check for uptime monitors (no secrets in response).
 */
export async function GET() {
  const serviceKey = getSupabaseServiceRoleKey()
  const checks: Record<string, boolean> = {
    supabase_url: hasSupabasePublicConfig(),
    supabase_anon: hasSupabasePublicConfig(),
    service_role: Boolean(serviceKey),
    session_secret: Boolean(getSessionSecret()),
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

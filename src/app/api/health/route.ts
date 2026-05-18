import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()

  try {
    // Ping the database
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    if (error) throw error

    const latency = Date.now() - start

    return NextResponse.json({
      status: 'ok',
      uptime: process.uptime(),
      db: 'connected',
      latency_ms: latency,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      status: 'error',
      error: message,
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}

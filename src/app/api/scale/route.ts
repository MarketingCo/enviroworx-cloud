export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Live scale ingest — called by the weighbridge monitor script at the yard
 * (scripts/weighbridge-monitor.py). Inserts a reading into
 * weighbridge_readings, which the office Weighbridge tab subscribes to via
 * realtime for the "capture from scale" buttons.
 *
 * Auth: Authorization: Bearer <SCALE_INGEST_SECRET>. The facility machine
 * never holds a database key.
 */
export async function POST(request: Request) {
  const secret = process.env.SCALE_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'SCALE_INGEST_SECRET not configured' }, { status: 503 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { weight_kg?: number; reg_number?: string; description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const weight = Number(body.weight_kg)
  if (!Number.isFinite(weight) || weight < 0 || weight > 100000) {
    return NextResponse.json({ error: 'weight_kg must be 0–100000' }, { status: 400 })
  }

  // tenant_id defaults to the Enviroworx tenant at the column level; revisit
  // when scale ingest becomes per-tenant (P5.3).
  const { error } = await supabaseAdmin.from('weighbridge_readings').insert({
    weight_kg: weight,
    reg_number: body.reg_number?.slice(0, 20) || null,
    description: body.description?.slice(0, 200) || 'scale_monitor',
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

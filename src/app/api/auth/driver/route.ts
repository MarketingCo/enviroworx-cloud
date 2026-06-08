import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSessionToken, sessionCookieName, sessionCookieOptions } from '@/lib/session'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const rl = rateLimit(`auth:driver:${clientIp(req)}`, 15, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec)

  const { name, pin } = await req.json()
  if (!name?.trim() || !pin?.trim()) {
    return NextResponse.json({ error: 'Name and PIN required' }, { status: 400 })
  }

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id, name')
    .eq('name', name.trim())
    .eq('pin_code', pin.trim())
    .maybeSingle()

  if (!driver) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSessionToken({
    sub: driver.id,
    name: driver.name,
    role: 'driver',
  })

  const res = NextResponse.json({ ok: true, user: { id: driver.id, name: driver.name } })
  res.cookies.set(sessionCookieName, token, sessionCookieOptions())
  return res
}

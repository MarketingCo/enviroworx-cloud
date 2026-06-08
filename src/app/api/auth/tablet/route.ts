import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSessionToken, sessionCookieName, sessionCookieOptions } from '@/lib/session'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit'

/** Yard tablet clock — PIN auth always enabled (independent of office Google-only mode). */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`auth:tablet:${clientIp(req)}`, 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec)

  const { name, pin } = await req.json()
  if (!name?.trim() || !pin?.trim()) {
    return NextResponse.json({ error: 'Name and PIN required' }, { status: 400 })
  }

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id, name')
    .ilike('name', name.trim())
    .eq('pin_code', pin.trim())
    .maybeSingle()

  const { data: yardStaff } = !driver
    ? await supabaseAdmin
        .from('yard_staff')
        .select('id, name')
        .ilike('name', name.trim())
        .eq('pin', pin.trim())
        .maybeSingle()
    : { data: null }

  const user = driver || yardStaff
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSessionToken({
    sub: user.id,
    name: user.name,
    role: driver ? 'driver' : 'yard',
  })

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: driver ? 'driver' : 'yard' },
  })
  res.cookies.set(sessionCookieName, token, sessionCookieOptions())
  return res
}

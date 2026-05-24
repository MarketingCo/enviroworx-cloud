import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSessionToken, sessionCookieName, sessionCookieOptions } from '@/lib/session'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const rl = rateLimit(`auth:portal:${clientIp(req)}`, 15, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec)

  const { name, pin } = await req.json()
  if (!name?.trim() || !pin?.trim()) {
    return NextResponse.json({ error: 'Name and PIN required' }, { status: 400 })
  }

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, name')
    .ilike('name', name.trim())
    .eq('portal_pin', pin.trim())
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSessionToken({
    sub: customer.id,
    name: customer.name,
    role: 'portal',
  })

  const res = NextResponse.json({ ok: true, customer: { id: customer.id, name: customer.name } })
  res.cookies.set(sessionCookieName, token, sessionCookieOptions())
  return res
}

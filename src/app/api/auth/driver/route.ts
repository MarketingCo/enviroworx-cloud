import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSessionToken, sessionCookieName, sessionCookieOptions } from '@/lib/session'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const rl = rateLimit(`auth:driver:${clientIp(req)}`, 15, 60_000)
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec)

  const { name, pin, tenantSlug } = await req.json()
  if (!name?.trim() || !pin?.trim()) {
    return NextResponse.json({ error: 'Name and PIN required' }, { status: 400 })
  }

  // Resolve tenant from slug if provided, otherwise default to Enviroworx
  let tenantId = '56ec5b3f-6d42-4672-a98c-d60d9c22f284'
  if (tenantSlug?.trim()) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug.trim())
      .maybeSingle()
    if (!tenant) return NextResponse.json({ error: 'Unknown tenant' }, { status: 400 })
    tenantId = tenant.id
  }

  const query = supabaseAdmin
    .from('drivers')
    .select('id, name, tenant_id')
    .eq('name', name.trim())
    .eq('pin_code', pin.trim())
    .eq('tenant_id', tenantId)

  const { data: driver } = await query.maybeSingle()

  if (!driver) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSessionToken({
    sub: driver.id,
    name: driver.name,
    role: 'driver',
    tenantId: driver.tenant_id ?? tenantId,
  })

  const res = NextResponse.json({ ok: true, user: { id: driver.id, name: driver.name } })
  res.cookies.set(sessionCookieName, token, sessionCookieOptions())
  return res
}

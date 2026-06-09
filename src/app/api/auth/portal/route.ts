import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSessionToken, sessionCookieName, sessionCookieOptions } from '@/lib/session'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const rl = rateLimit(`auth:portal:${clientIp(req)}`, 15, 60_000)
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

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, name, tenant_id')
    .ilike('name', name.trim())
    .eq('portal_pin', pin.trim())
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSessionToken({
    sub: customer.id,
    name: customer.name,
    role: 'portal',
    tenantId: customer.tenant_id ?? tenantId,
  })

  const res = NextResponse.json({ ok: true, customer: { id: customer.id, name: customer.name } })
  res.cookies.set(sessionCookieName, token, sessionCookieOptions())
  return res
}

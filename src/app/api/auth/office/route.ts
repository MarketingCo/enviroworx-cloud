import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSessionToken, sessionCookieName, sessionCookieOptions } from '@/lib/session'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { officePinAuthEnabled } from '@/lib/office-google'

export async function POST(req: NextRequest) {
  if (!officePinAuthEnabled()) {
    return NextResponse.json({ error: 'PIN login disabled. Use Google sign-in.' }, { status: 403 })
  }

  const rl = rateLimit(`auth:office:${clientIp(req)}`, 15, 60_000)
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

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id, name, tenant_id')
    .ilike('name', name.trim())
    .eq('pin_code', pin.trim())
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const { data: yardStaff } = !driver
    ? await supabaseAdmin
        .from('yard_staff')
        .select('id, name, tenant_id')
        .ilike('name', name.trim())
        .eq('pin', pin.trim())
        .eq('tenant_id', tenantId)
        .maybeSingle()
    : { data: null }

  const user = driver || yardStaff
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const resolvedTenantId = user.tenant_id ?? tenantId
  const token = await createSessionToken({
    sub: user.id,
    name: user.name,
    role: driver ? 'driver' : 'yard',
    tenantId: resolvedTenantId,
  })

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: driver ? 'driver' : 'yard' },
  })
  res.cookies.set(sessionCookieName, token, sessionCookieOptions())
  return res
}

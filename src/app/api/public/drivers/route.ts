export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Replaces the anon-readable drivers_public view (dropped in the
// multi-tenancy migration): name list for the driver/tablet login
// dropdowns. Names only — no PINs, no phones, tenant-scoped.
const DEFAULT_TENANT_ID = '56ec5b3f-6d42-4672-a98c-d60d9c22f284'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('tenant')?.trim()
  let tenantId = DEFAULT_TENANT_ID
  if (slug) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!tenant) return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 })
    tenantId = tenant.id
  }

  const { data, error } = await supabaseAdmin
    .from('drivers')
    .select('id, name, status')
    .eq('tenant_id', tenantId)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

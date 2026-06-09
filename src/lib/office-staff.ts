import { supabaseAdmin } from '@/lib/supabase'
import { isOfficeGoogleEmailAllowed } from '@/lib/office-google'

export type OfficeStaffRole = 'admin' | 'office' | 'dispatch'

/** The Enviroworx tenant UUID — used as fallback for domain-allowlist Google users */
const ENVIROWORX_TENANT_ID = '56ec5b3f-6d42-4672-a98c-d60d9c22f284'

export type OfficeStaffRecord = {
  email: string
  display_name: string | null
  role: OfficeStaffRole
  tenantId: string
}

export async function lookupOfficeStaff(email: string): Promise<OfficeStaffRecord | null> {
  const normalized = email.toLowerCase().trim()
  if (!normalized) return null

  const { data } = await supabaseAdmin
    .from('office_staff')
    .select('email, display_name, role, tenant_id')
    .ilike('email', normalized)
    .eq('active', true)
    .maybeSingle()

  if (data) {
    const row = data as { email: string; display_name: string | null; role: string; tenant_id: string | null }
    const role = (['admin', 'office', 'dispatch'].includes(row.role)
      ? row.role
      : 'office') as OfficeStaffRole
    return {
      email: row.email.toLowerCase(),
      display_name: row.display_name,
      role,
      tenantId: row.tenant_id ?? ENVIROWORX_TENANT_ID,
    }
  }

  if (isOfficeGoogleEmailAllowed(normalized)) {
    return { email: normalized, display_name: null, role: 'office', tenantId: ENVIROWORX_TENANT_ID }
  }

  return null
}

export function isOfficeStaffRole(role: OfficeStaffRole): boolean {
  return role === 'admin' || role === 'office' || role === 'dispatch'
}

import { supabaseAdmin } from '@/lib/supabase'
import { isOfficeGoogleEmailAllowed } from '@/lib/office-google'

export type OfficeStaffRole = 'admin' | 'office' | 'dispatch'

export type OfficeStaffRecord = {
  email: string
  display_name: string | null
  role: OfficeStaffRole
}

export async function lookupOfficeStaff(email: string): Promise<OfficeStaffRecord | null> {
  const normalized = email.toLowerCase().trim()
  if (!normalized) return null

  const { data } = await supabaseAdmin
    .from('office_staff')
    .select('email, display_name, role')
    .ilike('email', normalized)
    .eq('active', true)
    .maybeSingle()

  if (data) {
    const row = data as { email: string; display_name: string | null; role: string }
    const role = (['admin', 'office', 'dispatch'].includes(row.role)
      ? row.role
      : 'office') as OfficeStaffRole
    return {
      email: row.email.toLowerCase(),
      display_name: row.display_name,
      role,
    }
  }

  if (isOfficeGoogleEmailAllowed(normalized)) {
    return { email: normalized, display_name: null, role: 'office' }
  }

  return null
}

export function isOfficeStaffRole(role: OfficeStaffRole): boolean {
  return role === 'admin' || role === 'office' || role === 'dispatch'
}

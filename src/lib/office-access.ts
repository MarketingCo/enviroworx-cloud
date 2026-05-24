import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { officePinAuthEnabled } from '@/lib/office-google'
import { lookupOfficeStaff } from '@/lib/office-staff'

const OFFICE_ROLES = ['office', 'driver', 'yard'] as const

export async function canAccessOfficeRoutes(
  googleUser: User | null,
  request: NextRequest
): Promise<boolean> {
  if (googleUser?.email && (await lookupOfficeStaff(googleUser.email))) return true

  if (officePinAuthEnabled()) {
    const session = await getSessionFromRequest(request)
    if (session && OFFICE_ROLES.includes(session.role as (typeof OFFICE_ROLES)[number])) {
      return true
    }
  }

  return false
}
